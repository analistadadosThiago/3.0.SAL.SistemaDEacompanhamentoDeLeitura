import React, { useState } from 'react';
import { Zap } from 'lucide-react';

interface LogoProps {
  className?: string;
  imgClassName?: string;
  showText?: boolean;
  textSize?: string;
  iconSize?: string;
}

export const Logo: React.FC<LogoProps> = ({ 
  className = "flex items-center gap-3", 
  imgClassName = "h-10 w-auto object-contain",
  showText = true,
  textSize = "text-xl",
  iconSize = "w-10 h-10"
}) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {!imgError ? (
        <img 
          src="/logo.png" 
          alt="SAL - Sistema de Análise de Leitura" 
          onError={() => setImgError(true)}
          className={`${imgClassName} rounded-xl shadow-md transition-transform hover:scale-105`}
        />
      ) : (
        <div className={`${iconSize} rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1.5px] shadow-lg shadow-blue-500/25 shrink-0 transition-transform hover:scale-105`}>
          <div className="w-full h-full bg-[#0a0f1d] rounded-[10px] flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-sm"></div>
            <Zap className="w-5 h-5 text-cyan-400 fill-cyan-400/80 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] relative z-10" />
          </div>
        </div>
      )}

      {showText && (
        <div className="flex flex-col select-none">
          <div className="flex items-center gap-1.5">
            <span className={`text-white font-black tracking-tight leading-none ${textSize}`}>
              SAL
            </span>
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          </div>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-1 leading-tight">
            Sistema de Análise de Leitura
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
