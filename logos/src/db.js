const mongoose = require('mongoose');

// Database connection configuration
const connectDB = async () => {
  try {
    mongoose.set('strictQuery', false);
    
    // If Mongose URI not set in env, default to localhost
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/logoss',
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;