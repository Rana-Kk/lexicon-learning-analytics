import express from 'express';
import cors from 'cors';
import errorHandler from './middleware/errorHandler.js';

// Rotalar
import authRoutes from './routes/auth.routes.js';
import coursesRoutes from './routes/courses.routes.js';
import groupsRoutes from './routes/groups.routes.js';
import usersRoutes from './routes/users.routes.js';
import assessmentsRoutes from './routes/assessments.routes.js';
import submissionsRoutes from './routes/submissions.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import quizzesRoutes from './routes/quizzes.routes.js';
import competenciesRoutes from './routes/competencies.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';
import certificatesRoutes from './routes/certificates.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import teamsRoutes from './routes/teams.routes.js';
import studentChecklistRoutes from './routes/studentChecklist.routes.js';
import criteriaTemplatesRoutes from './routes/criteriaTemplates.routes.js';

const app = express();

app.use(cors());
app.use(express.json());


// API Uçları
app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/assessments', assessmentsRoutes);
app.use('/api/submissions', submissionsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/competencies', competenciesRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/certificates', certificatesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/criteria-templates', criteriaTemplatesRoutes);
app.use('/api/student-checklists', studentChecklistRoutes);

// Hata Yakalayıcı (En altta kalmalı)
app.use(errorHandler);

export { app };
export default app;