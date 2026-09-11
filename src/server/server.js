const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const crypto = require("crypto");
const User = require("./models/UserModel");
const Transaction = require("./models/TransactionModel");

dotenv.config();

console.log("MongoDB variable found:", !!process.env.MONGODB_URI);

const app = express();

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());

app.use(express.json());

// ==========================================
// CHECK ENVIRONMENT VARIABLE
// ==========================================

console.log("MongoDB URI loaded:", process.env.MONGODB_URI ? "YES" : "NO");

// ==========================================
// MONGODB CONNECTION
// ==========================================

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((error) => {
    console.error("MongoDB connection failed:");
    console.error(error.message);
  });

// ==========================================
// SIGN UP
// ==========================================

app.post("/api/signup", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    // Check required fields
    if (!fullName || !email || !password) {
      return res.status(400).json({
        message: "Please fill in all fields.",
      });
    }

    // Check password length
    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters.",
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return res.status(400).json({
        message: "An account with this email already exists.",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      walletBalance: 0,
    });

    res.status(201).json({
      message: "Account created successfully.",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        walletBalance: user.walletBalance,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);

    res.status(500).json({
      message: "Something went wrong while creating your account.",
    });
  }
});

// ==========================================
// LOGIN
// ==========================================

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check required fields
    if (!email || !password) {
      return res.status(400).json({
        message: "Please enter your email and password.",
      });
    }

    // Find user
    const user = await User.findOne({
      email: email.toLowerCase(),
    });

    // User doesn't exist
    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    // Compare password with hashed password
    const passwordMatch = await bcrypt.compare(password, user.password);

    // Password is incorrect
    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    // Login successful
    res.status(200).json({
      message: "Login successful.",

      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        walletBalance: user.walletBalance,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      message: "Something went wrong while logging in.",
    });
  }
});

// ==========================================
// GET USER
// ==========================================

app.get("/api/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    res.status(200).json({
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        walletBalance: user.walletBalance,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);

    res.status(500).json({
      message: "Unable to get user information.",
    });
  }
});


// ==========================================
// GET USER TRANSACTIONS
// ==========================================

app.get("/api/transactions/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Find all transactions belonging to this user
    const transactions = await Transaction.find({
      userId: userId,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      transactions: transactions,
    });
  } catch (error) {
    console.error("Get transactions error:");
    console.error(error.message);

    res.status(500).json({
      message: "Unable to load transactions.",
    });
  }
});

// ==========================================
// GET NIGERIAN BANKS
// ==========================================

app.get("/api/banks", async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.flutterwave.com/v3/banks/NG",
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        },
      },
    );

    res.status(200).json({
      banks: response.data?.data || [],
    });
  } catch (error) {
    console.error("Get banks error:");

    console.error(error.response?.data || error.message);

    res.status(500).json({
      message: "Unable to load banks.",
    });
  }
});

// ==========================================
// VERIFY BANK ACCOUNT
// ==========================================

app.post("/api/verify-bank-account", async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.body;

    // Check required fields
    if (!accountNumber || !bankCode) {
      return res.status(400).json({
        message: "Bank and account number are required.",
      });
    }

    // Basic account number validation
    if (!/^\d{10}$/.test(accountNumber)) {
      return res.status(400).json({
        message: "Account number must be 10 digits.",
      });
    }

    // Ask Flutterwave to resolve account
    const response = await axios.post(
      "https://api.flutterwave.com/v3/accounts/resolve",

      {
        account_number: accountNumber,

        account_bank: bankCode,
      },

      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,

          "Content-Type": "application/json",
        },
      },
    );

    // Check Flutterwave response
    if (
      response.data?.status !== "success" ||
      !response.data?.data?.account_name
    ) {
      return res.status(400).json({
        message:
          response.data?.message || "Unable to verify this bank account.",
      });
    }

    // Return verified account information
    return res.status(200).json({
      message: "Bank account verified successfully.",

      account: {
        accountNumber: response.data.data.account_number,

        accountName: response.data.data.account_name,
      },
    });
  } catch (error) {
    console.error("Bank account verification error:");

    console.error(error.response?.data || error.message);

    return res.status(400).json({
      message:
        error.response?.data?.message || "Unable to verify bank account.",
    });
  }
});
// ==========================================
// WITHDRAW FROM WALLET
// ==========================================

app.post("/api/withdraw", async (req, res) => {
  try {
    const { userId, amount, accountNumber, bankCode, accountName } = req.body;

    // ==========================================
    // CHECK REQUIRED INFORMATION
    // ==========================================

    if (
      !userId ||
      amount === undefined ||
      !accountNumber ||
      !bankCode ||
      !accountName
    ) {
      return res.status(400).json({
        message:
          "User, amount, bank, account number and account name are required.",
      });
    }

    // ==========================================
    // CONVERT AMOUNT
    // ==========================================

    const withdrawalAmount = Number(amount);

    // ==========================================
    // VALIDATE AMOUNT
    // ==========================================

    if (!Number.isFinite(withdrawalAmount) || withdrawalAmount <= 0) {
      return res.status(400).json({
        message: "Please enter a valid withdrawal amount.",
      });
    }

    // ==========================================
    // FIND USER
    // ==========================================

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    // ==========================================
    // CHECK WALLET BALANCE
    // ==========================================

    const currentBalance = Number(user.walletBalance || 0);

    if (withdrawalAmount > currentBalance) {
      return res.status(400).json({
        message: "Insufficient wallet balance.",
      });
    }

    // ==========================================
    // VALIDATE ACCOUNT NUMBER
    // ==========================================

    if (!/^\d{10}$/.test(accountNumber)) {
      return res.status(400).json({
        message: "Account number must be 10 digits.",
      });
    }

    // ==========================================
    // CREATE UNIQUE TRANSACTION REFERENCE
    // ==========================================

    const txRef = `GIFTLY-WD-${Date.now()}-${user._id}`;

    // ==========================================
    // CREATE PENDING TRANSACTION
    // ==========================================

    const transaction = await Transaction.create({
      userId: user._id,

      txRef: txRef,

      amount: withdrawalAmount,

      currency: "NGN",

      type: "withdrawal",

      status: "pending",
    });

    console.log("Withdrawal transaction created:", txRef);

    // ==========================================
    // SEND TRANSFER THROUGH FLUTTERWAVE
    // ==========================================

    let response;

    try {
      response = await axios.post(
        "https://api.flutterwave.com/v3/transfers",

        {
          account_bank: bankCode,

          account_number: accountNumber,

          amount: withdrawalAmount,

          currency: "NGN",

          narration: "Giftly wallet withdrawal",

          reference: txRef,

          beneficiary_name: accountName,
        },

        {
          headers: {
            Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,

            "Content-Type": "application/json",
          },
        },
      );

      console.log("FLUTTERWAVE TRANSFER RESPONSE:");
      console.log(JSON.stringify(response.data, null, 2));
    } catch (transferError) {
      console.error("Flutterwave transfer failed:");

      console.error(transferError.response?.data || transferError.message);

      // ==========================================
      // REFUND WALLET
      // ==========================================

      const refundUser = await User.findById(userId);

      if (refundUser) {
        const refundBalance = Number(refundUser.walletBalance || 0);

        // Only refund if this transaction
        // has not already been refunded.

        if (!transaction.refunded) {
          refundUser.walletBalance = refundBalance + withdrawalAmount;

          await refundUser.save();

          transaction.refunded = true;

          console.log(
            `Wallet refunded: ₦${withdrawalAmount} → ${refundUser.email}`,
          );
        }
      }

      // ==========================================
      // MARK TRANSACTION AS FAILED
      // ==========================================

      transaction.status = "failed";

      transaction.failureReason =
        transferError.response?.data?.message ||
        transferError.message ||
        "Flutterwave transfer failed.";

      await transaction.save();

      // ==========================================
      // RETURN ERROR
      // ==========================================

      return res.status(400).json({
        message:
          transferError.response?.data?.message ||
          "Withdrawal failed. Your wallet has been refunded.",
      });
    }

    // ==========================================
    // CHECK FLUTTERWAVE RESPONSE
    // ==========================================

    if (response.data?.status !== "success") {
      console.error("Flutterwave transfer rejected:", response.data);

      transaction.status = "failed";

      transaction.failureReason =
        response.data?.message || "Flutterwave transfer failed.";

      await transaction.save();

      // Wallet was NOT deducted.
      // No refund is necessary.

      return res.status(400).json({
        message:
          response.data?.message ||
          "Withdrawal failed. Your wallet balance was not changed.",
      });
    }

    // ==========================================
    // CHECK PROVIDER TRANSFER DATA
    // ==========================================

    const transferData = response.data?.data;

    if (!transferData) {
      transaction.status = "failed";

      transaction.failureReason =
        "Flutterwave returned an invalid transfer response.";

      await transaction.save();

      return res.status(400).json({
        message:
          "Withdrawal could not be completed. Your wallet balance was not changed.",
      });
    }

    // ==========================================
    // DEDUCT WALLET BALANCE
    // ==========================================

    // Re-check the user's balance immediately
    // before deducting it.

    const freshUser = await User.findById(userId);

    if (!freshUser) {
      transaction.status = "failed";

      transaction.failureReason =
        "User account could not be found after transfer.";

      await transaction.save();

      console.error("User disappeared after Flutterwave transfer:", userId);

      return res.status(500).json({
        message:
          "The transfer was accepted but your wallet could not be updated. Please contact support.",
      });
    }

    const freshBalance = Number(freshUser.walletBalance || 0);

    // ==========================================
    // SAFETY CHECK
    // ==========================================

    if (withdrawalAmount > freshBalance) {
      transaction.status = "failed";

      transaction.failureReason =
        "Insufficient wallet balance during final balance check.";

      await transaction.save();

      console.error("Balance changed before withdrawal completion:", txRef);

      return res.status(400).json({
        message:
          "Your wallet balance changed before the withdrawal could be completed.",
      });
    }

    // ==========================================
    // FINAL WALLET DEDUCTION
    // ==========================================

    freshUser.walletBalance = freshBalance - withdrawalAmount;

    await freshUser.save();

    console.log(`Wallet debited: ₦${withdrawalAmount} → ${freshUser.email}`);

    // ==========================================
    // SAVE PROVIDER REFERENCE
    // ==========================================

    transaction.providerReference = transferData.id
      ? transferData.id.toString()
      : null;

    // ==========================================
    // UPDATE TRANSACTION STATUS
    // ==========================================

    transaction.status = "successful";

    await transaction.save();

    // ==========================================
    // RETURN SUCCESS
    // ==========================================

    return res.status(200).json({
      message: "Withdrawal successful.",

      withdrawal: {
        amount: withdrawalAmount,

        accountName: accountName,

        accountNumber: accountNumber,

        txRef: txRef,

        walletBalance: freshUser.walletBalance,
      },
    });
  } catch (error) {
    console.error("Withdrawal error:");

    console.error(error.response?.data || error.message);

    return res.status(500).json({
      message: error.response?.data?.message || "Unable to process withdrawal.",
    });
  }
});

// ==========================================
// CHECK WITHDRAWAL STATUS
// ==========================================

app.get("/api/withdraw-status/:txRef", async (req, res) => {
  try {
    const { txRef } = req.params;

    // ==========================================
    // FIND GIFTLY TRANSACTION
    // ==========================================

    const transaction = await Transaction.findOne({
      txRef: txRef,
      type: "withdrawal",
    });

    if (!transaction) {
      return res.status(404).json({
        message: "Withdrawal transaction not found.",
      });
    }

    // ==========================================
    // MAKE SURE WE HAVE FLUTTERWAVE ID
    // ==========================================

    if (!transaction.providerReference) {
      return res.status(400).json({
        message: "Flutterwave transfer ID is not available yet.",
      });
    }

    // ==========================================
    // ASK FLUTTERWAVE FOR TRANSFER STATUS
    // ==========================================

    const response = await axios.get(
      `https://api.flutterwave.com/v3/transfers/${transaction.providerReference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,

          "Content-Type": "application/json",
        },
      },
    );

    const transfer = response.data?.data;

    if (!transfer) {
      return res.status(400).json({
        message: "Unable to retrieve transfer status.",
      });
    }

    console.log("Flutterwave transfer status:", transfer);

    // ==========================================
    // TRANSFER FAILED
    // ==========================================

    if (transfer.status === "FAILED" || transfer.status === "failed") {
      const user = await User.findById(transaction.userId);

      if (user && !transaction.refunded) {
        user.walletBalance =
          Number(user.walletBalance || 0) + Number(transaction.amount);

        await user.save();

        transaction.refunded = true;

        console.log(`Wallet refunded: ₦${transaction.amount} → ${user.email}`);
      }

      transaction.status = "failed";

      transaction.failureReason =
        transfer.complete_message || "Flutterwave transfer failed.";

      await transaction.save();

      return res.status(200).json({
        status: "failed",

        message: "Withdrawal failed. Your wallet has been refunded.",

        refunded: true,

        walletBalance: user?.walletBalance,
      });
    }

    // ==========================================
    // TRANSFER SUCCESSFUL
    // ==========================================

    if (transfer.status === "SUCCESSFUL" || transfer.status === "successful") {
      transaction.status = "successful";

      transaction.providerReference = transfer.id
        ? transfer.id.toString()
        : transaction.providerReference;

      await transaction.save();

      return res.status(200).json({
        status: "successful",

        message: "Withdrawal was successful.",

        refunded: false,
      });
    }

    // ==========================================
    // TRANSFER STILL PROCESSING
    // ==========================================

    return res.status(200).json({
      status: transfer.status?.toLowerCase() || "pending",

      message: "Withdrawal is still being processed.",

      refunded: false,
    });
  } catch (error) {
    console.error("Withdrawal status error:");

    console.error(error.response?.data || error.message);

    return res.status(500).json({
      message:
        error.response?.data?.message || "Unable to check withdrawal status.",
    });
  }
});

// ==========================================
// FLUTTERWAVE TRANSFER WEBHOOK
// ==========================================

app.post("/api/flutterwave-transfer-webhook", async (req, res) => {
  try {
    // ==========================================
    // VERIFY FLUTTERWAVE WEBHOOK
    // ==========================================

    const webhookHash = req.headers["verif-hash"];

    const secretHash = process.env.FLW_SECRET_HASH;

    if (!secretHash || webhookHash !== secretHash) {
      console.error("Invalid Flutterwave webhook signature.");

      return res.status(401).json({
        message: "Invalid webhook signature.",
      });
    }

    // ==========================================
    // GET WEBHOOK DATA
    // ==========================================

    const webhookData = req.body?.data;

    if (!webhookData) {
      return res.status(400).json({
        message: "Invalid webhook data.",
      });
    }

    const transferId = webhookData.id;

    const txRef = webhookData.reference;

    const transferStatus = String(webhookData.status || "").toUpperCase();

    console.log("Flutterwave transfer webhook:", {
      transferId,
      txRef,
      transferStatus,
    });

    // ==========================================
    // FIND GIFTLY TRANSACTION
    // ==========================================

    const transaction = await Transaction.findOne({
      txRef: txRef,
      type: "withdrawal",
    });

    if (!transaction) {
      console.error("Giftly withdrawal not found:", txRef);

      // Still acknowledge webhook
      return res.status(200).json({
        message: "Webhook received.",
      });
    }

    // ==========================================
    // TRANSFER FAILED
    // ==========================================

    if (transferStatus === "FAILED") {
      // Already refunded?
      if (transaction.refunded) {
        console.log("Withdrawal already refunded:", txRef);

        return res.status(200).json({
          message: "Already refunded.",
        });
      }

      // ==========================================
      // FIND USER
      // ==========================================

      const user = await User.findById(transaction.userId);

      if (!user) {
        console.error("User not found for refund:", transaction.userId);

        return res.status(200).json({
          message: "Webhook received but user was not found.",
        });
      }

      // ==========================================
      // REFUND WALLET
      // ==========================================

      user.walletBalance =
        Number(user.walletBalance || 0) + Number(transaction.amount);

      await user.save();

      console.log(`Automatic refund: ₦${transaction.amount} → ${user.email}`);

      // ==========================================
      // UPDATE TRANSACTION
      // ==========================================

      transaction.status = "failed";

      transaction.refunded = true;

      transaction.failureReason =
        webhookData.complete_message ||
        webhookData.message ||
        "Flutterwave transfer failed.";

      transaction.providerReference = transferId
        ? transferId.toString()
        : transaction.providerReference;

      await transaction.save();

      console.log("Withdrawal marked failed and refunded:", txRef);

      return res.status(200).json({
        message: "Withdrawal failed and wallet refunded.",
      });
    }

    // ==========================================
    // TRANSFER SUCCESSFUL
    // ==========================================

    if (transferStatus === "SUCCESSFUL") {
      transaction.status = "successful";

      transaction.providerReference = transferId
        ? transferId.toString()
        : transaction.providerReference;

      await transaction.save();

      console.log("Withdrawal confirmed successful:", txRef);

      return res.status(200).json({
        message: "Withdrawal marked successful.",
      });
    }

    // ==========================================
    // PENDING / NEW
    // ==========================================

    console.log("Withdrawal still processing:", transferStatus);

    return res.status(200).json({
      message: "Transfer status received.",
    });
  } catch (error) {
    console.error("Flutterwave webhook error:");

    console.error(error.response?.data || error.message);

    return res.status(500).json({
      message: "Webhook processing failed.",
    });
  }
});
// ==========================================
// CREATE FLUTTERWAVE PAYMENT
// ==========================================
// ==========================================
// CREATE FLUTTERWAVE PAYMENT
// ==========================================

app.post("/api/fund-wallet", async (req, res) => {
  try {
    const { userId, amount } = req.body;

    // Check required information
    if (!userId || amount === undefined) {
      return res.status(400).json({
        message: "User and amount are required.",
      });
    }

    // Convert amount to number
    const paymentAmount = Number(amount);

    // Validate amount
    if (!Number.isFinite(paymentAmount) || paymentAmount < 100) {
      return res.status(400).json({
        message: "Minimum wallet funding amount is ₦100.",
      });
    }

    // Find user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    // Create unique transaction reference
    const txRef = `GIFTLY-${Date.now()}-${user._id}`;

    // Save pending transaction first
    await Transaction.create({
      userId: user._id,
      txRef: txRef,
      amount: paymentAmount,
      currency: "NGN",
      type: "wallet_funding",
      status: "pending",
    });

    // Create Flutterwave payment
    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref: txRef,

        amount: paymentAmount,

        currency: "NGN",

       redirect_url: "https://giftly-1.onrender.com/api/payment-callback",

        customer: {
          email: user.email,
          name: user.fullName,
        },

        customizations: {
          title: "Giftly Wallet",
          description: "Fund your Giftly wallet",
        },

        meta: {
          userId: user._id.toString(),
        },
      },

      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,

          "Content-Type": "application/json",
        },
      },
    );

    // Return Flutterwave payment link
    if (response.data && response.data.data && response.data.data.link) {
      return res.status(200).json({
        message: "Payment initialized successfully.",

        link: response.data.data.link,

        tx_ref: txRef,
      });
    }

    // If Flutterwave did not return a link
    await Transaction.findOneAndUpdate(
      { txRef: txRef },
      {
        status: "failed",
        failureReason: "Flutterwave did not return a payment link.",
      },
    );

    return res.status(500).json({
      message: "Unable to create Flutterwave payment.",
    });
  } catch (error) {
    console.error("Flutterwave payment error:");

    console.error(error.response?.data || error.message);

    res.status(500).json({
      message: "Unable to initialize payment.",
    });
  }
});

// ==========================================
// TEMPORARY FLUTTERWAVE VERIFICATION TEST
// ==========================================

app.get("/api/test-payment/:transactionId", async (req, res) => {
  try {
    const transactionId = req.params.transactionId;

    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        },
      },
    );

    console.log("Flutterwave test verification:");

    console.log(response.data);

    res.json(response.data);
  } catch (error) {
    console.error("Test verification error:");

    console.error(error.response?.data || error.message);

    res.status(500).json({
      message: "Unable to verify transaction.",

      error: error.response?.data || error.message,
    });
  }
});

// ==========================================
// FLUTTERWAVE PAYMENT CALLBACK
// ==========================================

// ==========================================
// FLUTTERWAVE PAYMENT CALLBACK
// ==========================================

app.get("/api/payment-callback", async (req, res) => {
  try {
    const { transaction_id, tx_ref, status } = req.query;

    console.log("Flutterwave callback received:");

    console.log({
      transaction_id,
      tx_ref,
      status,
    });

    // ==========================================
    // PAYMENT NOT COMPLETED
    // ==========================================

    if (status !== "successful" && status !== "completed") {
     return res.redirect(
    "http://127.0.0.1:3000/src/dashboard.html?payment=cancelled"
);
    }

    // ==========================================
    // TRANSACTION ID REQUIRED
    // ==========================================

    if (!transaction_id) {
     return res.redirect(
    "http://127.0.0.1:3000/src/dashboard.html?payment=failed"
);
    }

    // ==========================================
    // FIND OUR EXISTING TRANSACTION
    // ==========================================

    const giftlyTransaction = await Transaction.findOne({
      txRef: tx_ref,
      type: "wallet_funding",
    });

    if (!giftlyTransaction) {
      console.error("Giftly transaction not found:", tx_ref);

      return res.redirect(
    "http://127.0.0.1:3000/src/dashboard.html?payment=failed"
);
    }

    // ==========================================
    // ALREADY PROCESSED?
    // ==========================================

    if (giftlyTransaction.status === "successful") {
      console.log("Payment already processed:", tx_ref);

    return res.redirect(
    "http://127.0.0.1:3000/src/dashboard.html?payment=success"
);
    }

    // ==========================================
    // VERIFY PAYMENT WITH FLUTTERWAVE
    // ==========================================

    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,

      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        },
      },
    );

    const payment = response.data?.data;

    console.log("Verified Flutterwave payment:");

    console.log(payment);

    // ==========================================
    // VERIFY PAYMENT DETAILS
    // ==========================================

    if (
      !payment ||
      payment.status !== "successful" ||
      payment.tx_ref !== tx_ref ||
      payment.currency !== "NGN"
    ) {
      console.error("Flutterwave verification failed:", payment);

      giftlyTransaction.status = "failed";

      giftlyTransaction.failureReason =
        "Flutterwave payment verification failed.";

      await giftlyTransaction.save();

     return res.redirect(
    "http://127.0.0.1:3000/src/dashboard.html?payment=failed"
);
    }

    // ==========================================
    // GET USER
    // ==========================================

    const user = await User.findById(giftlyTransaction.userId);

    if (!user) {
      console.error("User not found:", giftlyTransaction.userId);

    return res.redirect(
    "http://127.0.0.1:3000/src/dashboard.html?payment=failed"
);
    }

    // ==========================================
    // GET ACTUAL AMOUNT PAID
    // ==========================================

    const paidAmount = Number(payment.amount);

    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      console.error("Invalid payment amount:", payment.amount);

      giftlyTransaction.status = "failed";

      giftlyTransaction.failureReason = "Invalid payment amount.";

      await giftlyTransaction.save();

      return res.redirect(
    "http://127.0.0.1:3000/src/dashboard.html?payment=failed"
);
    }

    // ==========================================
    // SAFETY CHECK
    // ==========================================

    // Make sure the amount paid matches
    // the amount we expected.

    if (paidAmount !== Number(giftlyTransaction.amount)) {
      console.error("Payment amount mismatch:", {
        expected: giftlyTransaction.amount,

        received: paidAmount,
      });

      giftlyTransaction.status = "failed";

      giftlyTransaction.failureReason = "Payment amount mismatch.";

      await giftlyTransaction.save();

      return res.redirect(
    "http://127.0.0.1:3000/src/dashboard.html?payment=failed"
);
    }

    // ==========================================
    // CREDIT WALLET
    // ==========================================

    user.walletBalance = Number(user.walletBalance || 0) + paidAmount;

    await user.save();

    console.log(`Wallet credited: ₦${paidAmount} → ${user.email}`);

    // ==========================================
    // UPDATE EXISTING TRANSACTION
    // ==========================================

    giftlyTransaction.transactionId = transaction_id.toString();

    giftlyTransaction.status = "successful";

    giftlyTransaction.failureReason = undefined;

    await giftlyTransaction.save();

    console.log("Transaction marked successful:", tx_ref);

    // ==========================================
    // REDIRECT TO DASHBOARD
    // ==========================================

  return res.redirect(
    "http://127.0.0.1:3000/src/dashboard.html?payment=success"
);
  } catch (error) {
    console.error("Payment verification error:");

    console.error(error.response?.data || error.message);

   return res.redirect(
    "http://127.0.0.1:3000/src/dashboard.html?payment=failed"
);
  }
});

// ==========================================
// TEST ROUTE
// ==========================================

app.get("/", (req, res) => {
  res.json({
    message: "Giftly API is running successfully.",
  });
});

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Giftly server running on port ${PORT}`);
});
