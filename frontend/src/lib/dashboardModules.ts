import {
  BarChart2,
  Users,
  ShoppingCart,
  Crown,
  Settings2,
  Package,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface AppModule {
  name: string;
  href: string;
  icon: LucideIcon;
  bgFrom: string;
  bgTo: string;
  iconClass: string;
  roles: string[];
  tourId: string;
  tourDescription: string;
}

export const MODULES: AppModule[] = [
  {
    name: "Dashboard",
    href: "/dashboard/metrics",
    icon: BarChart2,
    bgFrom: "#0fa078",
    bgTo: "#0c7e5f",
    iconClass: "text-white",
    roles: ["ADMIN", "OPERATOR"],
    tourId: "tile-metrics",
    tourDescription: "Tus métricas personales de ventas: conversión, facturado del mes y ranking.",
  },
  {
    name: "Clientes",
    href: "/customers",
    icon: Users,
    bgFrom: "#8ecfe0",
    bgTo: "#60b8d0",
    iconClass: "text-white",
    roles: ["ADMIN", "OPERATOR"],
    tourId: "tile-customers",
    tourDescription: "Cargá y organizá tus clientes, con etiquetas de color para clasificarlos.",
  },
  {
    name: "Catálogo",
    href: "/products",
    icon: Package,
    bgFrom: "#86efac",
    bgTo: "#22c55e",
    iconClass: "text-white",
    roles: ["ADMIN", "OPERATOR"],
    tourId: "tile-catalog",
    tourDescription: "Consultá las láminas disponibles, sus especificaciones y precios.",
  },
  {
    name: "Ventas",
    href: "/orders",
    icon: ShoppingCart,
    bgFrom: "#dcea88",
    bgTo: "#c3d45e",
    iconClass: "text-[#4d6010]",
    roles: ["ADMIN", "OPERATOR"],
    tourId: "tile-orders",
    tourDescription: "Armá presupuestos, hacé seguimiento y generá garantías de tus ventas.",
  },
  {
    name: "Panel Admin",
    href: "/admin",
    icon: Crown,
    bgFrom: "#f7de5a",
    bgTo: "#f0c520",
    iconClass: "text-[#7a5800]",
    roles: ["ADMIN"],
    tourId: "tile-admin",
    tourDescription: "Vista global de la operación: ventas, usuarios y catálogo de todo el equipo.",
  },
  {
    name: "Configuración",
    href: "/settings",
    icon: Settings2,
    bgFrom: "#44c8b8",
    bgTo: "#28a898",
    iconClass: "text-white",
    roles: ["ADMIN", "OPERATOR"],
    tourId: "tile-settings",
    tourDescription: "Tu perfil, los datos de tu empresa y la conexión con Gmail.",
  },
];
