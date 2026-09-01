interface IconCircleProps {
  label: string;
  color: string;
  size?: number;
  fontSize?: number;
  /** Явная иконка (эмодзи) — если задана, показывается целиком вместо
   *  первой буквы label (нельзя резать эмодзи через charAt). */
  icon?: string;
}

export function IconCircle({ label, color, size = 36, fontSize = 14, icon }: IconCircleProps) {
  return (
    <div
      className="icon-circle"
      style={{
        width: size,
        height: size,
        fontSize,
        ['--circle-color' as string]: color,
      }}
    >
      {icon || label.charAt(0).toUpperCase()}
    </div>
  );
}
