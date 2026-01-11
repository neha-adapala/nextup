import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  importance: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    default: 3
  },
  dueDate: {
    type: Date
  },
  estimatedMinutes: {
    type: Number,
    min: 0,
    default: null
  },
  done: {
    type: Boolean,
    default: false,
    index: true
  },
  completedAt: {
    type: Date
  },
  source: {
    type: String,
    enum: ['email', 'manual', 'calendar'],
    default: 'manual'
  },
  sourceId: {
    type: String // Email ID, calendar event ID, etc.
  },
  sourceData: {
    type: mongoose.Schema.Types.Mixed // Store additional source info
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for common queries
taskSchema.index({ userId: 1, done: 1, dueDate: 1 });
taskSchema.index({ userId: 1, importance: -1, createdAt: -1 });

// Update updatedAt before saving
taskSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Task = mongoose.model('Task', taskSchema);

export default Task;

