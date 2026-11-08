// format.js'dagi ORDER_TYPES / PAY_METHODS / KITCHEN_STATES jadvallarining
// `icon` maydonini render qiladi; nom belgilanmasa hech narsa chiqmaydi.
export default function MapIcon({ map, name, size = 15, className, fallback }) {
  const Icon = map?.[name]?.icon || fallback;
  return Icon ? <Icon size={size} className={className} /> : null;
}
