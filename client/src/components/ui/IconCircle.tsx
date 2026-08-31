interface IconCircleProps {
  label: string;
  color: string;
  size?: number;
  fontSize?: number;
}

export function IconCircle({ label, color, size = 36, fontSize = 14 }: IconCircleProps) {
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
      {label.charAt(0).toUpperCase()}
    </div>
  );
}
