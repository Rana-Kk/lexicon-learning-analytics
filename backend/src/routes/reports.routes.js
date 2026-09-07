import {Router} from 'express';import {authenticate} from '../middleware/auth.js';import {studentReport} from '../controllers/reports.controller.js';
const r=Router();r.use(authenticate);r.get('/student/:studentId',studentReport);r.get('/me',async (req,res,next)=>{req.params.studentId=req.user.sub;return studentReport(req,res,next)});export default r;
