export function LogoMark({ size = 30, className = "" }) {
  return <img src="/static/bright-mark.png?v=clear6" alt="" width={size} height={size} className={className} />;
}
export default function Logo({size=30,school=false,className="",light=false}) { return <span className={`inline-flex items-center gap-2 ${className}`}><img src="/static/bright-wordmark.png" alt="Bright" style={{height:size*0.82,width:"auto",objectFit:"contain",flexShrink:0}} />{school && <span className={light?"text-white":"text-ink"}>School</span>}</span>; }
