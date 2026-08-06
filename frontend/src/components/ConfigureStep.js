import React, { useState } from 'react';
import axios from 'axios';
import { Sliders } from 'lucide-react';
import './ConfigureStep.css';

const API_URL = 'http://localhost:5000/api';

function ConfigureStep({ onNext, onPrevious }) {
  const [positions, setPositions] = useState({
    agent_photo: { x: 400, y: 500, max_width: 500, max_height: 600 },
    name_text: { x: 400, y: 850, font_size: 60, color: '#FFFFFF' },
    badges: { x: 50, y: 400, spacing: 120, size: 100 }
  });

  const [saved, setSaved] = useState(false);

  const handleUpdate = (category, field, value) => {
    setPositions(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: parseInt(value) || value
      }
    }));
    setSaved(false);
  };

  const savePositions = async () => {
    try {
      await axios.post(`${API_URL}/update-positions`, positions);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save positions:', error);
    }
  };

  return (
    <div className="configure-step">
      <h2><Sliders size={28} /> Configure Positions</h2>
      <p className="step-description">Adjust the positioning of elements on your certificates</p>

      <div className="config-grid">
        {/* Agent Photo */}
        <div className="config-section">
          <h3>Agent Photo Position</h3>
          <div className="config-inputs">
            <div className="input-group">
              <label>Center X</label>
              <input
                type="number"
                value={positions.agent_photo.x}
                onChange={(e) => handleUpdate('agent_photo', 'x', e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Center Y</label>
              <input
                type="number"
                value={positions.agent_photo.y}
                onChange={(e) => handleUpdate('agent_photo', 'y', e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Max Width</label>
              <input
                type="number"
                value={positions.agent_photo.max_width}
                onChange={(e) => handleUpdate('agent_photo', 'max_width', e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Max Height</label>
              <input
                type="number"
                value={positions.agent_photo.max_height}
                onChange={(e) => handleUpdate('agent_photo', 'max_height', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Name Text */}
        <div className="config-section">
          <h3>Name Text Position</h3>
          <div className="config-inputs">
            <div className="input-group">
              <label>Center X</label>
              <input
                type="number"
                value={positions.name_text.x}
                onChange={(e) => handleUpdate('name_text', 'x', e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Center Y</label>
              <input
                type="number"
                value={positions.name_text.y}
                onChange={(e) => handleUpdate('name_text', 'y', e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Font Size</label>
              <input
                type="number"
                value={positions.name_text.font_size}
                onChange={(e) => handleUpdate('name_text', 'font_size', e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Text Color</label>
              <input
                type="color"
                value={positions.name_text.color}
                onChange={(e) => handleUpdate('name_text', 'color', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="config-section">
          <h3>Badges Position</h3>
          <div className="config-inputs">
            <div className="input-group">
              <label>Start X</label>
              <input
                type="number"
                value={positions.badges.x}
                onChange={(e) => handleUpdate('badges', 'x', e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Start Y</label>
              <input
                type="number"
                value={positions.badges.y}
                onChange={(e) => handleUpdate('badges', 'y', e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Vertical Spacing</label>
              <input
                type="number"
                value={positions.badges.spacing}
                onChange={(e) => handleUpdate('badges', 'spacing', e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Badge Size</label>
              <input
                type="number"
                value={positions.badges.size}
                onChange={(e) => handleUpdate('badges', 'size', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="config-actions">
        <button className="save-config-btn" onClick={savePositions}>
          {saved ? '✓ Saved!' : 'Save Configuration'}
        </button>
      </div>

      <div className="navigation-buttons">
        <button className="prev-btn" onClick={onPrevious}>
          ← Previous
        </button>
        <button className="next-btn" onClick={onNext}>
          Next: Process Certificates →
        </button>
      </div>
    </div>
  );
}

export default ConfigureStep;
