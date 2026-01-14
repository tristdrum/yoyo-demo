"use client";

import { useState, useEffect } from "react";

const steps = [
  { number: 1, text: "Build a campaign with probability + caps." },
  { number: 2, text: "Simulate a transaction and evaluate eligibility." },
  { number: 3, text: "Issue reward + send message with fallback." },
  { number: 4, text: "Review logs for full traceability." },
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
