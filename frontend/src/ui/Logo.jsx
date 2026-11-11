export function LogoMark({ size = 30, className = "" }) {
  return <img src="/static/favicon.svg?v=artwork5" alt="" width={size} height={size} className={className} />;
}
export default function Logo({size=30,school=false,className="",light=false}) { return <span className={`inline-flex items-center gap-2 ${className}`}><img src="/static/bright-wordmark.svg" alt="Bright" style={{height:size*0.82,width:"auto",objectFit:"contain",flexShrink:0,background:light?"white":undefined,borderRadius:4}} />{school && <span className={light?"text-white":"text-ink"}>School</span>}</span>; }
