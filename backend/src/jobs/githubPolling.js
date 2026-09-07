import cron from 'node-cron';
import { pool } from '../config/db.js';
import { analyzeSubmissionWithGemini } from '../services/ai.service.js';

export const startGithubPolling = () => {
  // Run every 2 minutes (Can be adjusted to '*/5 * * * *' for 5 mins)
  cron.schedule('*/2 * * * *', async () => {
    console.log('[Cron] Starting GitHub polling cycle...');
    
    try {
      // 1. Find all submissions waiting to be analyzed
      const [submissions] = await pool.query(
        `SELECT id, github_url, commit_sha FROM assessment_submissions 
         WHERE status = 'submitted'`
      );

      if (submissions.length === 0) {
        console.log('[Cron] No pending submissions found.');
        return;
      }

      for (const sub of submissions) {
        try {
          // Extract owner and repo from URL (e.g., https://github.com/ayserana/my-project)
          const match = sub.github_url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
          if (!match) {
            console.log(`[Cron] Invalid GitHub URL for submission ${sub.id}: ${sub.github_url}`);
            continue;
          }
          
          const owner = match[1];
          const repo = match[2].replace('.git', ''); // Remove .git if exists

          // Fetch the latest commit from GitHub REST API (Using Native Fetch)
          const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits`);
          
          if (!response.ok) {
            console.log(`[Cron] Failed to fetch repo ${owner}/${repo}. Status: ${response.status}`);
            continue;
          }

          const commits = await response.json();
          const latestCommitSha = commits[0]?.sha;

          // If there is a new commit that we haven't analyzed yet
          if (latestCommitSha && latestCommitSha !== sub.commit_sha) {
            console.log(`[Cron] New commit found for submission ${sub.id}: ${latestCommitSha}`);
            
            // 2. Update status to 'analyzing' and save the new commit SHA
            await pool.query(
              `UPDATE assessment_submissions 
               SET commit_sha = ?, status = 'analyzing' 
               WHERE id = ?`,
              [latestCommitSha, sub.id]
            );

                   analyzeSubmissionWithGemini(sub.id, owner, repo, latestCommitSha);            // Example: await analyzeCodeWithAI(sub.id, owner, repo, latestCommitSha);
          } else {
             console.log(`[Cron] No new commits for submission ${sub.id}`);
          }
        } catch (innerError) {
           console.error(`[Cron] Error processing submission ${sub.id}:`, innerError.message);
        }
      }
    } catch (error) {
      console.error('[Cron] Error during GitHub polling:', error.message);
    }
  });
};