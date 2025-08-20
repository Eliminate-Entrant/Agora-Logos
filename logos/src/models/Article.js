const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true,
    unique: true
  },
  urlToImage: {
    type: String
  },
  publishedAt: {
    type: Date,
    required: true
  },
  source: {
    name: String,
    url: String
  },
  summary: {
    type: String,
    required: true
  },
  sentiment: {
    score: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      required: true
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      required: true
    },
    politicalBias: {
      type: String,
      enum: ['left', 'center', 'right'],
      required: true
    }
  },
  analyzedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});


ArticleSchema.index({ analyzedAt: -1 });
ArticleSchema.index({ 'sentiment.score': 1 });
ArticleSchema.index({ 'sentiment.politicalBias': 1 });

module.exports = mongoose.model('Article', ArticleSchema);
