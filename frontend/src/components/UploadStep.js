import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { Upload, CheckCircle, XCircle, FileText, Image as ImageIcon, Eye } from 'lucide-react';
import ImagePreviewModal from './ImagePreviewModal';
import './UploadStep.css';

const API_URL = 'http://localhost:5000/api';

function UploadStep({ uploadedData, setUploadedData, onNext }) {
  const [uploading, setUploading] = useState({});
  const [errors, setErrors] = useState({});
  const [csvPreview, setCsvPreview] = useState(null);
  const [previewModal, setPreviewModal] = useState(null);
  const [imagePreviews, setImagePreviews] = useState({});

  const createImagePreviews = (files, category) => {
    const previews = {};

    if (category === 'backgrounds' || category === 'badges') {
      Object.keys(files).forEach(key => {
        if (files[key]) {
          previews[key] = URL.createObjectURL(files[key]);
        }
      });
    } else if (category === 'photos') {
      previews.photos = files.map(file => ({
        name: file.name,
        url: URL.createObjectURL(file)
      }));
    }

    setImagePreviews(prev => ({ ...prev, [category]: previews }));
  };

  const handleFileUpload = async (files, category, endpoint) => {
    setUploading(prev => ({ ...prev, [category]: true }));
    setErrors(prev => ({ ...prev, [category]: null }));

    // Create previews for images
    if (category === 'backgrounds' || category === 'badges' || category === 'photos') {
      createImagePreviews(files, category);
    }

    const formData = new FormData();

    if (category === 'backgrounds') {
      formData.append('MDRT', files.mdrt);
      formData.append('COT', files.cot);
      formData.append('TOT', files.tot);
    } else if (category === 'badges') {
      formData.append('LM', files.lm);
      formData.append('HR', files.hr);
      formData.append('QC', files.qc);
    } else if (category === 'photos') {
      files.forEach(file => formData.append('photos', file));
    } else {
      formData.append(category, files);
    }

    try {
      const response = await axios.post(`${API_URL}/${endpoint}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setUploadedData(prev => ({ ...prev, [category]: response.data }));

        if (category === 'csv' && response.data.preview) {
          setCsvPreview(response.data);
        }
      }
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        [category]: error.response?.data?.error || 'Upload failed'
      }));
    } finally {
      setUploading(prev => ({ ...prev, [category]: false }));
    }
  };

  const openPreview = (imageUrl, imageName, tier) => {
    setPreviewModal({
      url: imageUrl,
      name: imageName,
      tier: tier
    });
  };

  const BackgroundsUploader = () => {
    const [files, setFiles] = useState({ mdrt: null, cot: null, tot: null });

    return (
      <div className="uploader-section">
        <h3><ImageIcon size={20} /> Background Images (Optional)</h3>
        <div className="backgrounds-grid">
          {['mdrt', 'cot', 'tot'].map(tier => (
            <div key={tier} className="background-upload-box">
              <label className="upload-label">
                {tier.toUpperCase()} - {tier === 'mdrt' ? 'Red' : tier === 'cot' ? 'Purple' : 'Gold'}
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => setFiles({ ...files, [tier]: e.target.files[0] })}
                className="file-input"
              />
              {files[tier] && <span className="file-name">✓ {files[tier].name}</span>}

              {/* Preview thumbnail */}
              {imagePreviews.backgrounds?.[tier] && (
                <div className="image-preview-container">
                  <img
                    src={imagePreviews.backgrounds[tier]}
                    alt={`${tier} preview`}
                    className="preview-thumbnail"
                  />
                  <button
                    className="preview-btn"
                    onClick={() => openPreview(imagePreviews.backgrounds[tier], `${tier.toUpperCase()} Background`, tier.toUpperCase())}
                  >
                    <Eye size={16} /> Preview
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          className="upload-btn"
          onClick={() => handleFileUpload(files, 'backgrounds', 'upload-backgrounds')}
          disabled={uploading.backgrounds}
        >
          {uploading.backgrounds ? 'Uploading...' : 'Upload Backgrounds'}
        </button>
        {uploadedData.backgrounds?.success && (
          <div className="success-msg"><CheckCircle size={16} /> Backgrounds uploaded successfully</div>
        )}
        {errors.backgrounds && <div className="error-msg"><XCircle size={16} /> {errors.backgrounds}</div>}
      </div>
    );
  };

  const BadgesUploader = () => {
    const [files, setFiles] = useState({ lm: null, hr: null, qc: null });

    return (
      <div className="uploader-section">
        <h3><ImageIcon size={20} /> Badge Images (Optional)</h3>
        <div className="backgrounds-grid">
          {[
            { key: 'lm', label: 'Life Member (LM)' },
            { key: 'hr', label: 'Honor Roll (HR)' },
            { key: 'qc', label: 'Quarter Century (QC)' }
          ].map(badge => (
            <div key={badge.key} className="background-upload-box">
              <label className="upload-label">{badge.label}</label>
              <input
                type="file"
                accept="image/png"
                onChange={(e) => setFiles({ ...files, [badge.key]: e.target.files[0] })}
                className="file-input"
              />
              {files[badge.key] && <span className="file-name">✓ {files[badge.key].name}</span>}

              {/* Preview thumbnail */}
              {imagePreviews.badges?.[badge.key] && (
                <div className="image-preview-container">
                  <img
                    src={imagePreviews.badges[badge.key]}
                    alt={`${badge.label} preview`}
                    className="preview-thumbnail"
                  />
                  <button
                    className="preview-btn"
                    onClick={() => openPreview(imagePreviews.badges[badge.key], badge.label, badge.key.toUpperCase())}
                  >
                    <Eye size={16} /> Preview
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          className="upload-btn"
          onClick={() => handleFileUpload(files, 'badges', 'upload-badges')}
          disabled={uploading.badges}
        >
          {uploading.badges ? 'Uploading...' : 'Upload Badges'}
        </button>
        {uploadedData.badges?.success && (
          <div className="success-msg"><CheckCircle size={16} /> Badges uploaded successfully</div>
        )}
        {errors.badges && <div className="error-msg"><XCircle size={16} /> {errors.badges}</div>}
      </div>
    );
  };

  // Font uploader removed - using default font

  const CSVUploader = () => {
    const [file, setFile] = useState(null);

    return (
      <div className="uploader-section">
        <h3><FileText size={20} /> CSV Data File</h3>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files[0])}
          className="file-input"
        />
        {file && <span className="file-name">✓ {file.name}</span>}
        <button
          className="upload-btn"
          onClick={() => handleFileUpload(file, 'csv', 'upload-csv')}
          disabled={uploading.csv}
        >
          {uploading.csv ? 'Uploading...' : 'Upload CSV'}
        </button>
        {csvPreview && (
          <div className="csv-preview">
            <p className="preview-title">Preview: {csvPreview.total_records} records found</p>
            <div className="preview-table">
              {csvPreview.preview.slice(0, 3).map((row, idx) => (
                <div key={idx} className="preview-row">
                  <strong>{row['Agent Name']}</strong> - {row['MDRT Title']}
                </div>
              ))}
            </div>
          </div>
        )}
        {errors.csv && <div className="error-msg"><XCircle size={16} /> {errors.csv}</div>}
      </div>
    );
  };

  const PhotosUploader = () => {
    const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
      accept: { 'image/*': ['.jpeg', '.jpg', '.png'] },
      onDrop: (files) => handleFileUpload(files, 'photos', 'upload-photos')
    });

    return (
      <div className="uploader-section">
        <h3><ImageIcon size={20} /> Agent Photos (Multiple)</h3>
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <Upload size={40} />
          {isDragActive ? (
            <p>Drop the photos here...</p>
          ) : (
            <p>Drag & drop agent photos here, or click to select<br/><small>Name files as Client_Cd.jpg</small></p>
          )}
        </div>

        {/* Photo thumbnails grid */}
        {imagePreviews.photos?.photos && imagePreviews.photos.photos.length > 0 && (
          <div className="photos-preview-grid">
            <h4 className="preview-title">{imagePreviews.photos.photos.length} Photos Uploaded</h4>
            <div className="photos-grid">
              {imagePreviews.photos.photos.map((photo, idx) => (
                <div key={idx} className="photo-preview-item">
                  <img
                    src={photo.url}
                    alt={photo.name}
                    className="photo-preview-thumbnail"
                    onClick={() => openPreview(photo.url, photo.name, 'Agent Photo')}
                  />
                  <div className="photo-preview-name">{photo.name}</div>
                  <button
                    className="preview-btn small"
                    onClick={() => openPreview(photo.url, photo.name, 'Agent Photo')}
                  >
                    <Eye size={14} /> View
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {uploadedData.photos?.count > 0 && (
          <div className="success-msg">
            <CheckCircle size={16} /> {uploadedData.photos.count} photos uploaded successfully
          </div>
        )}
        {errors.photos && <div className="error-msg"><XCircle size={16} /> {errors.photos}</div>}
      </div>
    );
  };

  // Allow proceeding even without all files uploaded (for testing)
  const allUploaded = true;

  return (
    <div className="upload-step">
      <h2>Upload Your Assets</h2>
      <p className="step-description">Upload files to generate certificates (all optional for testing)</p>

      <BackgroundsUploader />
      <BadgesUploader />
      <CSVUploader />
      <PhotosUploader />

      <div className="navigation-buttons">
        <button
          className="next-btn"
          onClick={onNext}
          disabled={!allUploaded}
        >
          Next: Process Certificates →
        </button>
      </div>

      {/* Image Preview Modal */}
      {previewModal && (
        <ImagePreviewModal
          image={previewModal}
          onClose={() => setPreviewModal(null)}
        />
      )}
    </div>
  );
}

export default UploadStep;
