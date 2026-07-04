import Transaction from "../models/transaction.js"
import User from "../models/user.js"
import Razorpay from "razorpay"
import crypto from "crypto"
import { exec } from "child_process"

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_PUBLISHABLE_KEY,
    key_secret: process.env.RAZORPAY_SECRET_KEY,
})

const plans = [
    {
        _id: "basic",
        name: "Basic",
        price: 999,
        credits: 100,
        features: ['100 text generations', '50 image generations', 'Standard support', 'Access to basic models']
    },
    {
        _id: "pro",
        name: "Pro",
        price: 3999,
        credits: 500,
        features: ['500 text generations', '200 image generations', 'Priority support', 'Access to pro models', 'Faster response time']
    },
    {
        _id: "premium",
        name: "Premium",
        price: 7499,
        credits: 1000,
        features: ['1000 text generations', '500 image generations', '24/7 VIP support', 'Access to premium models', 'Dedicated account manager']
    }
]

//API controller for getting all plans
export const getPlans = async (req, res)=>{
    try {
        res.json({success: true,plans})
    } catch (error) {
        res.json({success: false, message: error.message})
    }
}

// API controller for purchasing a plan (creates transaction & Hosted Razorpay Payment Link)
export const purchasePlan = async (req, res)=>{
    try {
        const { planId } = req.body
        const userId = req.user._id
        const plan = plans.find(plan=> plan._id === planId)

        if(!plan)
        {
            return res.json({success: false, message: "Invalid Plan"})
        }

        const transaction = await Transaction.create({
            userId: userId,
            planId: plan._id,
            amount: plan.price,
            credits: plan.credits,
            isPaid: false
        })

        // Create Hosted Razorpay Payment Link
        const options = {
            amount: plan.price * 100, // paise (1 INR = 100 paise)
            currency: "INR",
            accept_partial: false,
            expire_by: Math.floor(Date.now() / 1000) + 20 * 60, // Link expires in 20 minutes
            reference_id: transaction._id.toString(),
            description: `Credits purchase: ${plan.name} Plan`,
            customer: {
                name: req.user.name,
                email: req.user.email,
            },
            notify: {
                sms: false,
                email: false
            },
            reminder_enable: false,
            // Redirects to this URL after payment success
            callback_url: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/credit/verify?transactionId=${transaction._id}`,
            callback_method: "get"
        }

        const paymentLink = await razorpayInstance.paymentLink.create(options)

        // Print the payment page link to the terminal
        console.log("\n==============================================")
        console.log("💳 RAZORPAY HOSTED PAYMENT LINK GENERATED:")
        console.log(paymentLink.short_url)
        console.log("==============================================\n")

        // Automatically open the payment gateway in the user's default browser
        const startCmd = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
        exec(`${startCmd} ${paymentLink.short_url}`, (err) => {
            if (err) console.error("Failed to automatically open payment page:", err);
        })

        res.json({ success: true, paymentLinkUrl: paymentLink.short_url, transactionId: transaction._id })
    } catch (error) {
        console.error("Error in purchasePlan:", error)
        const errorMessage = error.error?.description || error.description || error.message || "An error occurred";
        res.json({ success: false, message: errorMessage })
    }
}

// API controller for verifying payment (supports both real signature check & fake verification for Postman testing)
export const verifyPayment = async (req, res)=>{
    try {
        const data = req.method === "GET" ? req.query : req.body
        const { 
            transactionId, 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature, 
            razorpay_payment_link_id, 
            razorpay_payment_link_reference_id, 
            razorpay_payment_link_status, 
            fake 
        } = data

        const transaction = await Transaction.findById(transactionId)
        if (!transaction) {
            if (req.method === "GET") {
                return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/loading?error=transaction_not_found`)
            }
            return res.json({ success: false, message: "Transaction not found" })
        }

        if (transaction.isPaid) {
            if (req.method === "GET") {
                return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/loading?message=already_paid`)
            }
            return res.json({ success: false, message: "Transaction already paid" })
        }

        let isVerified = false

        if (fake || !razorpay_signature) {
            // Fake payment verification for testing in Postman
            isVerified = true
        } else {
            // Real signature verification
            if (razorpay_payment_link_id) {
                // Payment link verification signature logic
                const text = `${razorpay_payment_link_id}|${razorpay_payment_link_reference_id}|${razorpay_payment_link_status}|${razorpay_payment_id}`
                const generated_signature = crypto
                    .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY)
                    .update(text)
                    .digest("hex")

                if (generated_signature === razorpay_signature) {
                    isVerified = true
                }
            } else if (razorpay_order_id) {
                // Standard order verification (fallback)
                const text = `${razorpay_order_id}|${razorpay_payment_id}`
                const generated_signature = crypto
                    .createHmac("sha256", process.env.RAZORPAY_SECRET_KEY)
                    .update(text)
                    .digest("hex")

                if (generated_signature === razorpay_signature) {
                    isVerified = true
                }
            }

            if (!isVerified) {
                if (req.method === "GET") {
                    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/loading?error=verification_failed`)
                }
                return res.json({ success: false, message: "Signature verification failed" })
            }
        }

        if (isVerified) {
            transaction.isPaid = true
            await transaction.save()

            const user = await User.findById(transaction.userId)
            if (user) {
                user.credits += transaction.credits
                await user.save()
                
                if (req.method === "GET") {
                    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/loading?success=true&credits=${user.credits}`)
                }
                return res.json({ success: true, message: "Payment verified, credits added successfully", credits: user.credits })
            } else {
                if (req.method === "GET") {
                    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/loading?error=user_not_found`)
                }
                return res.json({ success: false, message: "User not found" })
            }
        }
    } catch (error) {
        console.error("Error in verifyPayment:", error)
        const errorMessage = error.error?.description || error.description || error.message || "An error occurred";
        if (req.method === "GET") {
            return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/loading?error=${encodeURIComponent(errorMessage)}`)
        }
        res.json({ success: false, message: errorMessage })
    }
}