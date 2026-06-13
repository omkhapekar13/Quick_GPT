import express from 'express'
import { getPlans, purchasePlan, verifyPayment } from '../controllers/creditController.js'
import { protect } from '../middlewares/auth.js'

const creditRouter = express.Router()

creditRouter.get('/plans', getPlans)
creditRouter.post('/purchase', protect, purchasePlan)
creditRouter.post('/verify', verifyPayment)
creditRouter.get('/verify', verifyPayment)

export default creditRouter
