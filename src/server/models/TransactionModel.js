const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        txRef: {
            type: String,
            required: true,
            unique: true
        },

        transactionId: {
            type: String,
            unique: true,
            sparse: true
        },

        // wallet_funding, withdrawal, airtime, data, etc.
        type: {
            type: String,
            required: true,
            enum: [
                "wallet_funding",
                "withdrawal",
                "airtime",
                "data"
            ]
        },

        amount: {
            type: Number,
            required: true
        },

        currency: {
            type: String,
            required: true,
            default: "NGN"
        },

        // pending, successful, failed
        status: {
            type: String,
            required: true,
            enum: [
                "pending",
                "successful",
                "failed"
            ],
            default: "pending"
        },

        // Flutterwave transfer/payment reference
        providerReference: {
            type: String,
            default: null
        },

        // Useful if Flutterwave returns an error
        failureReason: {
    type: String,
    default: null
},

refunded: {
    type: Boolean,
    default: false
}
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Transaction",
    transactionSchema
);