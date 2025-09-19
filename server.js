const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = 'public/uploads/';
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// In-memory storage for reports (in a real app, use a database)
let reports = [];
let reportIdCounter = 1;

// -------------------- ROUTES -------------------- //

// Upload new report
app.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const { title, description, category, priority, location } = req.body;

    // Generate a ticket ID
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    const ticketID = `TKT-${yyyy}${mm}${dd}-${randomPart}`;

    const newReport = {
      id: reportIdCounter++,
      ticketID,
      title,
      description,
      category,
      priority: priority || 'medium',
      location,
      image: req.file.filename,
      fileUrl: `/uploads/${req.file.filename}`,
      status: 'pending', // pending, approved, denied
      createdAt: new Date().toISOString(),
      details: req.body
    };

    reports.push(newReport);

    res.json({
      message: 'Report submitted successfully',
      ticketID
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all reports (for admin panel)
app.get('/admin/reports', (req, res) => {
  res.json(reports);
});

// Update report status (approve/deny)
app.put('/admin/reports/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const reportIndex = reports.findIndex(r => r.id == id);

  if (reportIndex === -1) {
    return res.status(404).json({ error: 'Report not found' });
  }

  reports[reportIndex].status = status;
  res.json({ message: 'Report status updated' });
});

// ✅ Delete a report
app.delete('/admin/reports/:id', (req, res) => {
  const { id } = req.params;
  const index = reports.findIndex(r => r.id == id);

  if (index === -1) {
    return res.status(404).json({ error: 'Report not found' });
  }

  // Try deleting the uploaded file too
  const filePath = path.join(__dirname, 'public', reports[index].fileUrl.replace(/^\//, ''));
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, err => {
      if (err) console.error('Error deleting file:', err);
    });
  }

  reports.splice(index, 1);
  res.json({ message: 'Report deleted successfully' });
});

// Get approved reports (for gallery)
app.get('/gallery', (req, res) => {
  const approvedReports = reports.filter(report => report.status === 'approved');
  res.json(approvedReports);
});

// Stats endpoint (for index.html counters)
app.get('/stats', (req, res) => {
  const totalReports = reports.length;
  const resolved = reports.filter(r => r.status === 'resolved').length;
  const approved = reports.filter(r => r.status === 'approved').length;

  // Avg days to resolve (placeholder: assume resolved today)
  const resolvedReports = reports.filter(r => r.status === 'resolved');
  let avgDays = 0;
  if (resolvedReports.length > 0) {
    const totalDays = resolvedReports.reduce((sum, r) => {
      const created = new Date(r.createdAt);
      const resolvedDate = new Date();
      return sum + Math.ceil((resolvedDate - created) / (1000 * 60 * 60 * 24));
    }, 0);
    avgDays = (totalDays / resolvedReports.length).toFixed(1);
  }

  res.json({ totalReports, resolved, approved, avgDays });
});

// -------------------- START SERVER -------------------- //
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
