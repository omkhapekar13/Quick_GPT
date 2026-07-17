import mongoose from "mongoose";

const summarySchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true }, // markdown string
    messageRange: {
      from: { type: Date, required: true }, // oldest msg timestamp
      to: { type: Date, required: true }, // newest msg timestamp
    },
    messageCount: { type: Number, required: true },
    version: { type: Number, default: 1 }, // increments per room
  },
  { timestamps: true }
);

summarySchema.index({ roomId: 1, createdAt: -1 });

const Summary = mongoose.model("Summary", summarySchema);
export default Summary;
