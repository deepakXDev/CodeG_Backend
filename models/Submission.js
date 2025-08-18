const mongoose=require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2'); // 👈 Add this


const submissionSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  problemId: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Problem', 
    required: true 
  },
  contestId: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest' 
  },
  language: {
    type: String,
    enum: ['cpp', 'java', 'python', 'javascript'],
    required: true
  },
  // sourceCode: { type: String, required: true }, //as sourceCode-file can also be provided
  sourceCode: { type: String},
  filePath: {type: String},
  verdict: {
    type: String,
    // enum: [
    //   'AC',     // Accepted
    //   'WA',     // Wrong Answer
    //   'TLE',    // Time Limit Exceeded
    //   'MLE',    // Memory Limit Exceeded
    //   'RE',     // Runtime Error
    //   'CE',     // Compilation Error
    //   'SE',     // System Error
    //   'PENDING' // Processing
    // ],
    enum:['Accepted','Wrong Answer', 'Time Limit Exceeded', 
      'Memory Limit Exceeded', 'Runtime Error', 'Compilation Error','Pending','System Error'],
    default: 'Pending'
  },
  runtimeMs: { type: Number, min: 0 },
  memoryKb: { type: Number, min: 0 },
  errorMessage: { type: String },
  testCasesPassed: { type: Number, default: 0 },
  totalTestCases: { type: Number, default: 0 }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
submissionSchema.index({ userId: 1 });
submissionSchema.index({ problemId: 1 });
submissionSchema.index({ contestId: 1 });
submissionSchema.index({ verdict: 1 });
submissionSchema.index({ createdAt: -1 });

// Virtual for problem details
submissionSchema.virtual('problem', {
  ref: 'Problem',
  localField: 'problemId',
  foreignField: '_id',
  justOne: true
});

// Virtual for user details
submissionSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
  options: { select: 'username email' }
});

submissionSchema.plugin(mongoosePaginate); // 👈 Add this


module.exports=mongoose.model('Submission', submissionSchema);