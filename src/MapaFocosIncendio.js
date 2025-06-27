import React, { useEffect, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function MapaFocosIncendio() {
  const [map, setMap] = useState(null);
  const [mapType, setMapType] = useState("roadmap");
  const [focos, setFocos] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cidadeBusca, setCidadeBusca] = useState("");
  const [ufSelecionado, setUfSelecionado] = useState("");
  const [historico, setHistorico] = useState([]);
  const [raioAlerta, setRaioAlerta] = useState(50);
  const [estadoMaisCritico, setEstadoMaisCritico] = useState("");

  const API_KEY_GOOGLE = "SUA_CHAVE_GOOGLE_MAPS";
