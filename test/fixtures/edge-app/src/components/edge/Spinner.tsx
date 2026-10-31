export default function Spinner() {
  return <div><style>{`@keyframes spin{to{transform:rotate(360deg)}} .sp{width:40px;height:40px;border:4px solid #ccc;border-top-color:#0e7490;border-radius:50%;animation:spin .6s linear infinite}`}</style><div className="sp" role="status" aria-label="Loading" /></div>;
}
