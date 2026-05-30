import React, { useId } from 'react';

export default function Input({ 
  label, 
  error, 
  className = '', 
  ...props 
}) {
  const id = useId();

  return (
    <div className={`flex flex-col ${className}`} style={{ gap: '8px' }}>
      {label && (
        <label 
          htmlFor={id} 
          className="input-label"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={`input-field ${error ? 'error' : ''}`}
        {...props}
      />
      {error && (
        <span className="input-error-text">
          {error}
        </span>
      )}
    </div>
  );
}