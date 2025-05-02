import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create a unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExt = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + fileExt);
  },
});

// Create multer upload instance
export const upload = multer({
  storage: storage,
  // Limit file size (10MB)
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  // Filter by allowed file types
  fileFilter: function (req, file, cb) {
    // Get file extension
    const ext = path.extname(file.originalname).toLowerCase();
    
    // Only allow CSV, JSON, XML, and MD files
    if (ext !== '.csv' && ext !== '.json' && ext !== '.xml' && ext !== '.md') {
      return cb(new Error('Only CSV, JSON, XML, and Markdown files are allowed'));
    }
    
    cb(null, true);
  },
});
