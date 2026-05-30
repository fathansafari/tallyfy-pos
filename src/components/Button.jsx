import React from 'react';

export default function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  disabled = false,
  ...props 
}) {
  const variantClass = `btn-${variant}`;
  const sizeClass = `btn-${size}`;
  const baseClass = `btn ${variantClass} ${sizeClass}`;

  return (
    <button
      className={`${baseClass} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}