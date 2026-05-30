import React from 'react';

export default function ProductCard({ 
  product, 
  onAddToCart,
  className = '' 
}) {
  const formatPrice = (price) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(price);
  };

  const isOutOfStock = product.stock <= 0;

  return (
    <button 
      onClick={() => onAddToCart(product)}
      disabled={isOutOfStock}
      className={`text-left p-4 flex flex-col justify-between w-full h-[140px] transition-all hover:-translate-y-1 border-[3px] border-[#0A0A0A] shadow-[4px_4px_0_#0A0A0A] ${isOutOfStock ? 'opacity-60 cursor-not-allowed bg-[#E5E0D8]' : 'cursor-pointer bg-white hover:bg-[#F5F2EA]'} ${className}`}
    >
      <div>
        {/* Product Name */}
        <h3 className="font-display text-[14px] font-bold mb-1 leading-snug text-[#0A0A0A] line-clamp-2">
          {product.name}
        </h3>
        
        {/* Price */}
        <div className="text-[16px] font-bold font-mono text-[#2DC653] mt-2">
          {formatPrice(product.price)}
        </div>
      </div>

      <div className="flex justify-between items-end w-full mt-auto">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#888888]">
          {product.category || 'LAUK'}
        </span>
        {isOutOfStock && (
          <span className="text-[10px] bg-[#E63946] text-white px-1 font-bold">HABIS</span>
        )}
      </div>
    </button>
  );
}
