import React, { useState } from 'react';
import './App.css';
import UploadStep from './components/UploadStep';
import ProcessStep from './components/ProcessStep';
import ResultsStep from './components/ResultsStep';
import { Award, Upload, Zap, Download } from 'lucide-react';

function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedData, setUploadedData] = useState({
    backgrounds: {},
    badges: {},
    font: null,
    csv: null,
    photos: []
  });
  const [processResults, setProcessResults] = useState(null);

  const steps = [
    { id: 0, name: 'Upload Assets', icon: Upload, component: UploadStep },
    { id: 1, name: 'Process', icon: Zap, component: ProcessStep },
    { id: 2, name: 'Results', icon: Download, component: ResultsStep }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const CurrentStepComponent = steps[currentStep].component;

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <Award className="logo-icon" size={40} />
          <h1>MDRT Certificate Generator</h1>
          <p className="subtitle">Automated certificate creation with AI-powered background removal</p>
        </div>
      </header>

      <div className="container">
        {/* Progress Steps */}
        <div className="steps-container">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <div
                key={step.id}
                className={`step-item ${index === currentStep ? 'active' : ''} ${
                  index < currentStep ? 'completed' : ''
                }`}
              >
                <div className="step-icon-wrapper">
                  <StepIcon size={24} />
                </div>
                <div className="step-info">
                  <div className="step-number">Step {index + 1}</div>
                  <div className="step-name">{step.name}</div>
                </div>
                {index < steps.length - 1 && <div className="step-connector" />}
              </div>
            );
          })}
        </div>

        {/* Main Content */}
        <div className="main-content">
          <CurrentStepComponent
            uploadedData={uploadedData}
            setUploadedData={setUploadedData}
            processResults={processResults}
            setProcessResults={setProcessResults}
            onNext={handleNext}
            onPrevious={handlePrevious}
            isFirstStep={currentStep === 0}
            isLastStep={currentStep === steps.length - 1}
          />
        </div>
      </div>

      <footer className="app-footer">
        <p>© 2027 MDRT Certificate Generator • 100% Offline Processing</p>
      </footer>
    </div>
  );
}

export default App;
