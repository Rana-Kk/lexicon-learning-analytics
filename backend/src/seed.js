import bcrypt from 'bcryptjs';
import { pool } from './config/db.js';

async function seedDatabase() {
  try {
    console.log('[Seed] Inserting default users...');

    const adminPassword = await bcrypt.hash('admin123', 10);
    const teacherPassword = await bcrypt.hash('teacher1234', 10);

    await pool.query(
      `INSERT INTO users (name, email, password_hash, role, github_username) 
       VALUES (?, ?, ?, 'admin', ?) 
       ON DUPLICATE KEY UPDATE email=email`,
      ['System Admin', 'admin@test.com', adminPassword, 'admin-gh']
    );

    await pool.query(
      `INSERT INTO users (name, email, password_hash, role, github_username) 
       VALUES (?, ?, ?, 'teacher', ?) 
       ON DUPLICATE KEY UPDATE email=email`,
      ['Teacher Jane', 'teacher@test.com', teacherPassword, 'teacher-jane']
    );

    console.log('[Seed] Success! Default users created:');
    console.log(' - Admin: admin@test.com / admin123');
    console.log(' - Teacher: teacher@test.com / teacher1234');
    
    process.exit(0);
  } catch (err) {
    console.error('[Seed Error]:', err.message);
    process.exit(1);
  }
}

seedDatabase();