const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2"); // 👈 Add this

const testCaseSchema = new mongoose.Schema(
  {
    input: { type: String, required: true },
    output: { type: String, required: true },
    isSample: { type: Boolean, default: false },
    isHidden: { type: Boolean, default: true },
  },
  { _id: true }
);

const problemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      required: true,
    },
    tags: {
      type: [String],
      validate: {
        validator: (v) => v.length > 0,
        message: "At least one tag is required",
      },
    },
    descriptionMarkdown: { type: String, required: true },
    constraints: { type: [String], default: [] },
    timeLimit: {
      type: Number,
      required: true,
      min: 500,
      max: 10000, //in ms
      default: 1000,
    },
    memoryLimit: {
      // in MB
      type: Number,
      required: true,
      min: 16,
      max: 1024,
      default: 256,
    },
    isContest: { type: Boolean, default: false },
    testCases: [testCaseSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required:true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

problemSchema.index({ title: 1 });
problemSchema.index({ difficulty: 1 });
problemSchema.index({ tags: 1 });
problemSchema.index({ createdAt: -1 });

problemSchema.virtual("submissionCount", {
  ref: "Submission",
  localField: "_id",
  foreignField: "problemId",
  count: true,
});

problemSchema.virtual("acceptedCount", {
  ref: "Submission",
  localField: "_id",
  foreignField: "problemId",
  count: true,
  match: { verdict: "AC" },
});

problemSchema.plugin(mongoosePaginate); // 👈 Add this

module.exports = mongoose.model("Problem", problemSchema);
