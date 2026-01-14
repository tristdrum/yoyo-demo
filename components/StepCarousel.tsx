"use client";

import { useState, useEffect } from "react";

const steps = [
  { number: 1, text: "Build a campaign with global Nth rules + priorities." },
  { number: 2, text: "Simulate counter outcomes and reward probabilities." },
  { number: 3, text: "Issue CVS rewards or grant competition entries." },
  { number: 4, text: "Review decision logs for full traceability." }
];

export function StepCarousel() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="carousel">
      <div className="carousel-track-wrapper">
        <div
          className="carousel-track"
          style={{ transform: `translateX(-${currentStep * 100}%)` }}
        >
          {steps.map((step) => (
            <div key={step.number} className="carousel-slide">
              <span className="step-number">{step.number}</span>
              <p className="step-text">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="carousel-dots">
        {steps.map((_, index) => (
          <button
            key={index}
            className={`carousel-dot ${index === currentStep ? "active" : ""}`}
            onClick={() => setCurrentStep(index)}
            aria-label={`Go to step ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
