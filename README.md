Lexicon Learning Analytics & AI Feedback Platform

A learning analytics and AI-assisted feedback platform built during a Software Engineering internship (Erasmus+ Traineeship Mobility) at Lexicon Syd, Malmö, Sweden.

The platform helps teachers manage courses, groups, and assignments, while an AI evaluation pipeline automatically reviews student submissions and provides scoring suggestions and feedback drafts for teacher review.

Features
Role-based access for Admin, Teacher, and Student
Course, group, and team management
Assignment submission via GitHub, with automatic AI evaluation (Gemini API)
Criteria-based rubric assessment, plus checklist-based evaluation templates
Weekly team tasks with peer evaluation
Attendance tracking
Quiz results import (from Excel exports of an external quiz tool)
Tech Stack
Layer	Technology	Why
Frontend	React + TypeScript	Type safety and component reuse across three distinct role-based dashboards (Admin/Teacher/Student)
Backend	Node.js + Express (REST API)	Lightweight, fast to iterate on, matches the team's existing backend experience
Database	MySQL 8	Relational structure fits the course → group → team → student hierarchy and assessment relationships well
Authentication	JWT + RBAC	Stateless auth with role-based route protection
AI Evaluation	Google Gemini API	Used to analyze GitHub-submitted assignments against teacher-defined criteria and produce a draft score/feedback
Deployment
Service	Role	Notes
Vercel	Frontend hosting	Connected to this GitHub repo — auto-deploys on push
Render	Backend hosting (Express API)	Connected to this GitHub repo — auto-deploys on push
Aiven	Managed MySQL database	Chosen for a quick, managed MySQL instance without local/self-hosted setup

Frontend and backend are deployed independently and connected via the backend's public API URL, with CORS restricted to the deployed frontend domain.

Live site: https://lexicon-learning-analytics.vercel.app/
Local Setup
bash
# Clone the repo
git clone https://github.com/Rana-Kk/lexicon-learning-analytics.git
cd lexicon-learning-analytics

# Backend
cd backend
npm install
# create a .env file with DB, JWT, and Gemini API credentials
npm run db:init
npm run dev

# Frontend
cd ../frontend
npm install
npm run dev
Project Context

This project was developed as part of an Erasmus+ Software Engineering internship, following a phased roadmap (analysis → architecture → core development → feature development → analytics/AI → finalization) over a 9-week internship period.
