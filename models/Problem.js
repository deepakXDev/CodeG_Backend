const mongoose=require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2'); // 👈 Add this
// Mongoose does not have a built-in .paginate() method, you need to explicitly add the plugin mongoose-paginate-v2.

const testCaseSchema = new mongoose.Schema({
  input: { type: String, required: true },
  output: { type: String, required: true },
  isSample: { type: Boolean, default: false },
  isHidden: { type: Boolean, default: true }
}, { _id: true });

const problemSchema = new mongoose.Schema({
  slug: { 
    type: String, 
    required: true, 
    unique: true, // // ⚠️ This implicitly creates an index on "slug"
    validate: {
      validator: (v) => /^[a-z0-9-]+$/.test(v),
      message: "Slug must be lowercase alphanumeric with hyphens"
    }
  },
  title: { type: String, required: true, trim: true },
  difficulty: { 
    type: String, 
    enum: ['easy', 'medium', 'hard'], 
    required: true 
  },
  tags: { 
    type: [String], 
    validate: {
      validator: (v) => v.length > 0,
      message: "At least one tag is required"
    }
  },
  descriptionMarkdown: { type: String, required: true },
  constraints: { type: [String], default: [] },
  timeLimit: { // in seconds
    type: Number, 
    required: true,
    min: 0.5,
    max: 10,
    default: 1
  },
  memoryLimit: { // in MB
    type: Number,
    required: true,
    min: 16,
    max: 1024,
    default: 256
  },
  isContest: { type: Boolean, default: false },
  testCases: [testCaseSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
// problemSchema.index({ slug: 1 });
problemSchema.index({ difficulty: 1 });
problemSchema.index({ tags: 1 });
problemSchema.index({ createdAt: -1 });

// Virtual for submission count
problemSchema.virtual('submissionCount', {
  ref: 'Submission',
  localField: '_id',
  foreignField: 'problemId',
  count: true
});

// Virtual for accepted submission count
problemSchema.virtual('acceptedCount', {
  ref: 'Submission',
  localField: '_id',
  foreignField: 'problemId',
  count: true,
  match: { verdict: 'AC' }
});

// npm install mongoose-paginate-v2
problemSchema.plugin(mongoosePaginate); // 👈 Add this

module.exports=mongoose.model('Problem', problemSchema);