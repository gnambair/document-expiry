import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Container,
  Grid,
  Paper,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Stack,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Divider,
  Collapse,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import SearchIcon from "@mui/icons-material/Search";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

export default function Dashboard() {
  const [documents, setDocuments] = useState([]);
  const [editingDoc, setEditingDoc] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [messageOpen, setMessageOpen] = useState(false);
  const [uploadItems, setUploadItems] = useState([]); // [{ file, title, description, documentType }]
  const [stats, setStats] = useState(null);

  const token = localStorage.getItem("token");

  // search / pagination state
  const [query, setQuery] = useState("");
  const [docType, setDocType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [total, setTotal] = useState(0);

  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [expandedRows, setExpandedRows] = useState({}); // { [id]: true/false }

  // helper: safe date formatting
  const fmt = (d) => {
    try {
      return d ? new Date(d).toLocaleDateString() : "—";
    } catch {
      return "—";
    }
  };
  const toggleRow = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);
    setMessageOpen(true);
  };

  // fetch documents from search endpoint with current filters/pagination
  const fetchDocs = async ({
    page: p = page,
    query: q = query,
    type = docType,
    status: s = status,
  } = {}) => {
    try {
      setLoadingDocs(true);
      const params = new URLSearchParams();
      params.append("page", p);
      params.append("limit", limit);
      if (q && q.trim()) params.append("query", q.trim());
      if (type) params.append("type", type);
      if (s) params.append("status", s);

      const res = await axios.get(
        `http://localhost:5000/api/documents/search?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.data && res.data.documents) {
        setDocuments(res.data.documents);
        setTotal(res.data.total || 0);
        setPage(res.data.page || p);
      } else {
        setDocuments([]);
        setTotal(0);
      }
    } catch (err) {
      console.error("Error fetching documents:", err.response || err.message);
      showMessage("Failed to fetch documents.", "error");

      // fallback: try old endpoint if search not available
      try {
        const fallback = await axios.get(
          "http://localhost:5000/api/documents",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (fallback.data && fallback.data.documents) {
          setDocuments(fallback.data.documents);
          setTotal(fallback.data.documents.length);
        }
      } catch (e) {
        // ignore
      }
    } finally {
      setLoadingDocs(false);
    }
  };

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await axios.get("http://localhost:5000/api/documents/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data && res.data.stats) setStats(res.data.stats);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (!token) {
      window.location.href = "/login";
      return;
    }
    fetchDocs({ page: 1 });
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // file input change handler (supports multiple)
  const onFilesSelected = (fileList, defaults = {}) => {
    const files = Array.from(fileList || []);
    const items = files.map((f) => ({
      file: f,
      title:
        (defaults.title && defaults.title.trim()) ||
        f.name.replace(/\.[^/.]+$/, ""),
      description: defaults.description || "",
      documentType: defaults.documentType || "other",
    }));
    setUploadItems(items.slice(0, 10));
  };

  // upload handler
  const handleUpload = async (e) => {
    e.preventDefault();

    // If user populated uploadItems (multi-file mode)
    if (uploadItems && uploadItems.length > 0) {
      if (uploadItems.length > 10) {
        return showMessage("Maximum 10 files allowed at once.", "warning");
      }

      const formData = new FormData();
      uploadItems.forEach((it) => {
        formData.append("files", it.file);
        formData.append("titles[]", it.title || it.file.name);
        formData.append("descriptions[]", it.description || "");
        formData.append("documentTypes[]", it.documentType || "other");
      });

      try {
        const res = await axios.post(
          "http://localhost:5000/api/documents",
          formData,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const returnedDocs = Array.isArray(res.data?.documents)
          ? res.data.documents
          : [];

        if (!returnedDocs.length) {
          await fetchDocs({ page: 1 });
          setUploadItems([]);
          showMessage("Uploaded successfully (reloaded list).", "success");
          await fetchStats();
          return;
        }

        setDocuments((prev) => [...returnedDocs, ...prev]);
        setUploadItems([]);
        const fileInputs = document.querySelectorAll('input[type="file"]');
        fileInputs.forEach((fi) => (fi.value = ""));
        showMessage(
          `Uploaded ${returnedDocs.length} document(s) successfully!`
        );
        await fetchStats();
      } catch (err) {
        console.error("Multi-upload failed:", err.response || err.message);
        showMessage(
          "Upload failed: " + (err.response?.data?.message || err.message),
          "error"
        );
      }
      return;
    }

    // Single-file fallback
    const form = e.target;
    const fileInput = form.file || form.files;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      return showMessage("Please select a file to upload.", "warning");
    }

    const formData = new FormData();
    formData.append("title", form.title.value);
    formData.append("description", form.description.value || "");
    formData.append("documentType", form.documentType.value || "other");
    formData.append("file", fileInput.files[0]);

    try {
      const res = await axios.post(
        "http://localhost:5000/api/documents",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const returnedDocs = Array.isArray(res.data?.documents)
        ? res.data.documents
        : Array.isArray(res.data?.document)
        ? res.data.document
        : res.data?.document
        ? [res.data.document]
        : [];

      if (!returnedDocs.length) {
        await fetchDocs({ page: 1 });
        form.reset();
        showMessage("Uploaded successfully (reloaded list).", "success");
        await fetchStats();
        return;
      }

      await fetchDocs({ page: 1 });
      form.reset();
      showMessage("Uploaded successfully!", "success");
      await fetchStats();
    } catch (err) {
      console.error("Upload failed:", err.response || err.message);
      showMessage(
        "Upload failed: " + (err.response?.data?.message || err.message),
        "error"
      );
    }
  };

  // delete doc
  const handleDelete = async (docId) => {
    if (!window.confirm("Delete this document?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/documents/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setDocuments((prev) => prev.filter((d) => d._id !== docId));
      await fetchStats();
      await fetchDocs({ page });
      showMessage("Deleted successfully", "success");
    } catch (err) {
      console.error("Delete failed:", err.response || err.message);
      showMessage(
        "Delete failed: " + (err.response?.data?.message || err.message),
        "error"
      );
    }
  };

  // save edits
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingDoc) return;

    const payload = {
      title: editingDoc.title,
      description: editingDoc.description,
      documentType: editingDoc.documentType,
      reminderDays: Number(editingDoc.reminderDays || 30),
    };

    try {
      const res = await axios.put(
        `http://localhost:5000/api/documents/${editingDoc._id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updated =
        res.data && res.data.document
          ? res.data.document
          : { ...editingDoc, ...payload };

      if (updated.reminderDays)
        updated.reminderDays = Number(updated.reminderDays);

      setDocuments((prev) =>
        prev.map((d) => (d._id === updated._id ? updated : d))
      );

      await fetchStats();
      await fetchDocs({ page });

      setEditingDoc(null);
      showMessage("Updated successfully", "success");
    } catch (err) {
      console.error("Update failed:", err.response || err.message);
      showMessage(
        "Update failed: " + (err.response?.data?.message || err.message),
        "error"
      );
    }
  };

  const renderSectionExpiries = (doc) => {
    if (!doc.sectionExpiries || !doc.sectionExpiries.length) return "—";

    return (
      <Box sx={{ maxWidth: 260 }}>
        {doc.sectionExpiries.map((sec, idx) => (
          <Typography variant="body2" key={idx}>
            <strong>{sec.header || `Section ${idx + 1}`}:</strong>{" "}
            {sec.expiryDate ? fmt(sec.expiryDate) : sec.rawExpiry || "—"}
          </Typography>
        ))}
      </Box>
    );
  };

  // search handlers
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchDocs({ page: 1, query, type: docType, status });
  };

  const clearFilters = async () => {
    setQuery("");
    setDocType("");
    setStatus("");
    setPage(1);
    await fetchDocs({ page: 1, query: "", type: "", status: "" });
  };

  const totalPagesCount = Math.max(1, Math.ceil((total || 0) / limit));

  const statusChip = (value) => {
    if (!value) return <Chip label="—" size="small" />;
    if (value === "expired")
      return <Chip label="Expired" size="small" color="error" />;
    if (value === "expiring_soon")
      return <Chip label="Expiring Soon" size="small" color="warning" />;
    return <Chip label="Active" size="small" color="success" />;
  };

  const rowBg = (value) => {
    if (value === "expired") return "#fff0f0";
    if (value === "expiring_soon") return "#fffaf0";
    return "inherit";
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Top AppBar */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Document Expiry Dashboard
          </Typography>
          <IconButton color="inherit" onClick={handleLogout}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* Stats cards */}
        {stats && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Total Documents
                </Typography>
                <Typography variant="h5">{stats.total}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Active
                </Typography>
                <Typography variant="h5" color="success.main">
                  {stats.active}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Expiring Soon
                </Typography>
                <Typography variant="h5" color="warning.main">
                  {stats.expiring_soon}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Expired
                </Typography>
                <Typography variant="h5" color="error.main">
                  {stats.expired}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Search + Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Search & Filters
          </Typography>
          <Box
            component="form"
            onSubmit={handleSearchSubmit}
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
              alignItems: "center",
            }}
          >
            <TextField
              label="Search by title or description"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              fullWidth
              sx={{ minWidth: 260, flex: 2 }}
            />
            <FormControl sx={{ minWidth: 160, flex: 1 }}>
              <InputLabel>Type</InputLabel>
              <Select
                label="Type"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                <MenuItem value="">All types</MenuItem>
                <MenuItem value="passport">Passport</MenuItem>
                <MenuItem value="license">License</MenuItem>
                <MenuItem value="id_card">ID Card</MenuItem>
                <MenuItem value="contract">Contract</MenuItem>
                <MenuItem value="certificate">Certificate</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 160, flex: 1 }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <MenuItem value="">All status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="expiring_soon">Expiring Soon</MenuItem>
                <MenuItem value="expired">Expired</MenuItem>
              </Select>
            </FormControl>
            <Stack direction="row" spacing={1}>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SearchIcon />}
              >
                Search
              </Button>
              <Button variant="outlined" onClick={clearFilters}>
                Reset
              </Button>
            </Stack>
          </Box>
        </Paper>

        {/* Documents table */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 1,
            }}
          >
            <Typography variant="h6">Your Documents</Typography>
            <Typography variant="body2" color="text.secondary">
              Total: {total}
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />

          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell /> {/* expand/collapse icon column */}
                  <TableCell>Title</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Expiry Date</TableCell>
                  <TableCell>Section Expiries</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {documents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      {loadingDocs
                        ? "Loading documents..."
                        : "No documents yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  documents.map((doc) => {
                    const isExpanded = !!expandedRows[doc._id];
                    const snippet = doc.extractedText
                      ? doc.extractedText.slice(0, 300) +
                        (doc.extractedText.length > 300 ? "…" : "")
                      : "No detected expiry snippet available.";

                    return (
                      <React.Fragment key={doc._id}>
                        {/* Main row */}
                        <TableRow sx={{ backgroundColor: rowBg(doc.status) }}>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => toggleRow(doc._id)}
                              aria-label={isExpanded ? "Collapse" : "Expand"}
                            >
                              {isExpanded ? (
                                <KeyboardArrowUpIcon />
                              ) : (
                                <KeyboardArrowDownIcon />
                              )}
                            </IconButton>
                          </TableCell>
                          <TableCell>{doc.title}</TableCell>
                          <TableCell>{doc.documentType}</TableCell>
                          <TableCell>{fmt(doc.expiryDate)}</TableCell>
                          <TableCell>{renderSectionExpiries(doc)}</TableCell>
                          <TableCell>{statusChip(doc.status)}</TableCell>
                          <TableCell align="right">
                            <Stack
                              direction="row"
                              spacing={1}
                              justifyContent="end"
                            >
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<EditIcon />}
                                onClick={() => setEditingDoc({ ...doc })}
                              >
                                Edit
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => handleDelete(doc._id)}
                              >
                                Delete
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>

                        {/* Collapsible detail row */}
                        <TableRow>
                          <TableCell
                            style={{ paddingBottom: 0, paddingTop: 0 }}
                            colSpan={7}
                          >
                            <Collapse
                              in={isExpanded}
                              timeout="auto"
                              unmountOnExit
                            >
                              <Box sx={{ margin: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                  Detected Expiry Snippet
                                </Typography>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    whiteSpace: "pre-wrap",
                                    maxHeight: 200,
                                    overflow: "auto",
                                    bgcolor: "grey.50",
                                    p: 1.5,
                                    borderRadius: 1,
                                    border: "1px solid",
                                    borderColor: "divider",
                                  }}
                                >
                                  {snippet}
                                </Typography>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Box>

          {/* Pagination */}
          {totalPagesCount > 1 && (
            <Box sx={{ mt: 2, display: "flex", justifyContent: "center" }}>
              <Pagination
                count={totalPagesCount}
                page={page}
                onChange={(_, value) => {
                  setPage(value);
                  fetchDocs({ page: value });
                }}
                color="primary"
              />
            </Box>
          )}
        </Paper>

        {/* Upload section */}
        <Paper sx={{ p: 2, mb: 6 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 2,
            }}
          >
            <CloudUploadIcon />
            <Typography variant="h6">Upload New Document</Typography>
          </Box>

          <Box component="form" onSubmit={handleUpload}>
            {/* Top metadata inputs only when no multi-file selection */}
            {uploadItems.length === 0 && (
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField name="title" label="Title" fullWidth required />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    name="description"
                    label="Description (optional)"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth required>
                    <InputLabel>Type</InputLabel>
                    <Select name="documentType" defaultValue="">
                      <MenuItem value="" disabled>
                        Select Type
                      </MenuItem>
                      <MenuItem value="passport">Passport</MenuItem>
                      <MenuItem value="license">License</MenuItem>
                      <MenuItem value="id_card">ID Card</MenuItem>
                      <MenuItem value="contract">Contract</MenuItem>
                      <MenuItem value="certificate">Certificate</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            )}

            <Box sx={{ mt: 2 }}>
              <input
                type="file"
                name="files"
                accept=".pdf,image/*"
                multiple
                onChange={(e) =>
                  onFilesSelected(e.target.files, {
                    title: "",
                    description: "",
                    documentType: "other",
                  })
                }
              />
              <Typography
                variant="caption"
                sx={{ display: "block", mt: 1 }}
                color="text.secondary"
              >
                You can select up to 10 files. Selecting multiple shows per-file
                metadata editor.
              </Typography>
            </Box>

            {/* Per-file metadata editor */}
            {uploadItems.length > 0 && (
              <Box
                sx={{
                  mt: 2,
                  border: "1px dashed",
                  borderColor: "divider",
                  p: 2,
                }}
              >
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Files to upload ({uploadItems.length})
                </Typography>
                {uploadItems.map((item, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      mb: 2,
                      pb: 2,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="body2" fontWeight="bold">
                      {item.file.name} ({Math.round(item.file.size / 1024)} KB)
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <TextField
                        label="Title"
                        value={item.title}
                        onChange={(e) => {
                          const copy = [...uploadItems];
                          copy[idx].title = e.target.value;
                          setUploadItems(copy);
                        }}
                        required
                        sx={{ width: "60%" }}
                      />
                    </Box>
                    <Box sx={{ mt: 1 }}>
                      <TextField
                        label="Description (optional)"
                        value={item.description}
                        onChange={(e) => {
                          const copy = [...uploadItems];
                          copy[idx].description = e.target.value;
                          setUploadItems(copy);
                        }}
                        sx={{ width: "60%" }}
                      />
                    </Box>
                    <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
                      <FormControl sx={{ minWidth: 160 }}>
                        <InputLabel>Type</InputLabel>
                        <Select
                          label="Type"
                          value={item.documentType}
                          onChange={(e) => {
                            const copy = [...uploadItems];
                            copy[idx].documentType = e.target.value;
                            setUploadItems(copy);
                          }}
                        >
                          <MenuItem value="passport">Passport</MenuItem>
                          <MenuItem value="license">License</MenuItem>
                          <MenuItem value="id_card">ID Card</MenuItem>
                          <MenuItem value="contract">Contract</MenuItem>
                          <MenuItem value="certificate">Certificate</MenuItem>
                          <MenuItem value="other">Other</MenuItem>
                        </Select>
                      </FormControl>
                      <Button
                        variant="text"
                        color="error"
                        onClick={() =>
                          setUploadItems((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                      >
                        Remove
                      </Button>
                    </Box>
                  </Box>
                ))}

                <Button
                  variant="outlined"
                  onClick={() => {
                    setUploadItems([]);
                    const fileInputs =
                      document.querySelectorAll('input[type="file"]');
                    fileInputs.forEach((fi) => (fi.value = ""));
                  }}
                >
                  Cancel selection
                </Button>
              </Box>
            )}

            <Box sx={{ mt: 3 }}>
              <Button
                type="submit"
                variant="contained"
                startIcon={<CloudUploadIcon />}
              >
                Upload
              </Button>
            </Box>
          </Box>
        </Paper>
      </Container>

      {/* Edit Dialog */}
      <Dialog open={!!editingDoc} onClose={() => setEditingDoc(null)} fullWidth>
        <DialogTitle>Edit Document</DialogTitle>
        {editingDoc && (
          <Box component="form" onSubmit={handleSaveEdit}>
            <DialogContent
              sx={{ display: "flex", flexDirection: "column", gap: 2 }}
            >
              <TextField
                label="Title"
                value={editingDoc.title || ""}
                onChange={(e) =>
                  setEditingDoc({ ...editingDoc, title: e.target.value })
                }
                required
              />
              <TextField
                label="Description"
                value={editingDoc.description || ""}
                onChange={(e) =>
                  setEditingDoc({
                    ...editingDoc,
                    description: e.target.value,
                  })
                }
              />
              <FormControl>
                <InputLabel>Type</InputLabel>
                <Select
                  label="Type"
                  value={editingDoc.documentType || "other"}
                  onChange={(e) =>
                    setEditingDoc({
                      ...editingDoc,
                      documentType: e.target.value,
                    })
                  }
                >
                  <MenuItem value="passport">Passport</MenuItem>
                  <MenuItem value="license">License</MenuItem>
                  <MenuItem value="id_card">ID Card</MenuItem>
                  <MenuItem value="contract">Contract</MenuItem>
                  <MenuItem value="certificate">Certificate</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Reminder Days"
                type="number"
                inputProps={{ min: 0 }}
                value={editingDoc.reminderDays ?? 30}
                onChange={(e) =>
                  setEditingDoc({
                    ...editingDoc,
                    reminderDays: e.target.value,
                  })
                }
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditingDoc(null)}>Cancel</Button>
              <Button type="submit" variant="contained">
                Save
              </Button>
            </DialogActions>
          </Box>
        )}
      </Dialog>

      {/* Snackbar for messages */}
      <Snackbar
        open={messageOpen}
        autoHideDuration={4000}
        onClose={() => setMessageOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setMessageOpen(false)}
          severity={messageType}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
