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
  const estados = [
    "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG",
    "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR",
    "RS", "SC", "SE", "SP", "TO",
  ];

  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const loader = new Loader({
      apiKey: API_KEY_GOOGLE,
      version: "weekly",
      libraries: ["places"],
    });
    loader.load().then(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(location);

          const mapInstance = new window.google.maps.Map(
            document.getElementById("map"),
            {
              center: location,
              zoom: 6,
              mapTypeId: mapType,
            }
          );
          setMap(mapInstance);
        },
        (error) => {
          alert("Erro ao obter localização: " + error.message);
        }
      );
    });
  }, [mapType]);
  useEffect(() => {
    async function fetchFocos() {
      try {
        const response = await fetch(
          "https://firms.modaps.eosdis.nasa.gov/api/area/csv/MODIS_C6_1/Brazil/7d"
        );
        const dataText = await response.text();
        const linhas = dataText.split("\n").slice(1);
        const focosData = [];
        const contador = {};
        const porEstado = {};

        for (let linha of linhas) {
          const partes = linha.split(",");
          if (partes.length < 10) continue;
          const lat = parseFloat(partes[1]);
          const lng = parseFloat(partes[2]);
          const data = partes[5];
          const estado = partes[8];

          if (ufSelecionado && estado !== ufSelecionado) continue;

          focosData.push({ lat, lng, data, estado });

          if (!contador[data]) contador[data] = 0;
          contador[data]++;

          if (!porEstado[estado]) porEstado[estado] = 0;
          porEstado[estado]++;
        }

        const historicoArray = Object.entries(contador).map(([data, total]) => ({
          data,
          total,
        }));
        historicoArray.sort((a, b) => new Date(a.data) - new Date(b.data));

        const estadoCritico =
          Object.entries(porEstado).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

        setFocos(focosData);
        setHistorico(historicoArray);
        setEstadoMaisCritico(estadoCritico);
        setLoading(false);
      } catch (e) {
        console.error("Erro ao buscar dados da NASA", e);
        alert("Erro ao carregar dados dos últimos 7 dias.");
      }
    }
    fetchFocos();
  }, [ufSelecionado]);
  useEffect(() => {
    if (!map || focos.length === 0) return;

    // Limpar marcadores antigos
    if (window.markers) {
      window.markers.forEach((m) => m.setMap(null));
    }
    window.markers = [];

    focos.forEach(({ lat, lng, data, estado }) => {
      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map: map,
        title: `Foco em ${estado} - Data: ${data}`,
        icon: {
          url: "https://maps.google.com/mapfiles/ms/icons/firedept.png",
        },
      });

      window.markers.push(marker);
    });

    // Verifica se algum foco está dentro do raio de alerta do usuário
    if (userLocation) {
      focos.forEach(({ lat, lng, estado }) => {
        const distancia = window.google.maps.geometry.spherical.computeDistanceBetween(
          new window.google.maps.LatLng(userLocation.lat, userLocation.lng),
          new window.google.maps.LatLng(lat, lng)
        );

        if (distancia <= raioAlerta * 1000) {
          if (Notification.permission === "granted") {
            new Notification(
              `Alerta: Foco de incêndio em ${estado} a ${(
                distancia / 1000
              ).toFixed(2)} km de você!`
            );
          }
        }
      });
    }
  }, [map, focos, userLocation, raioAlerta]);

  // Função para buscar cidade pelo nome
  async function buscarCidade() {
    if (!cidadeBusca) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: cidadeBusca + ", Brasil" }, (results, status) => {
      if (status === "OK" && results[0]) {
        const loc = results[0].geometry.location;
        map.setCenter(loc);
        map.setZoom(10);
      } else {
        alert("Cidade não encontrada.");
      }
    });
  }
  // Exportar histórico em CSV
  function exportarCSV() {
    let csv = "data,total\n";
    historico.forEach(({ data, total }) => {
      csv += `${data},${total}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "historico_focos.csv";
    link.click();
  }

  // Exportar histórico em PDF
  function exportarPDF() {
    const doc = new jsPDF();
    doc.text("Histórico de Focos de Incêndio", 14, 20);
    doc.autoTable({
      head: [["Data", "Total"]],
      body: historico.map(({ data, total }) => [data, total]),
      startY: 30,
    });
    doc.save("historico_focos.pdf");
  }

  return (
    <div style={{ padding: 10 }}>
      <h1>Monitoramento de Focos de Incêndio no Brasil</h1>

      <div>
        <label>
          Estado:
          <select
            value={ufSelecionado}
            onChange={(e) => setUfSelecionado(e.target.value)}
            style={{ marginLeft: 10 }}
          >
            <option value="">Todos</option>
            {estados.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </label>

        <label style={{ marginLeft: 20 }}>
          Buscar cidade:
          <input
            type="text"
            value={cidadeBusca}
            onChange={(e) => setCidadeBusca(e.target.value)}
            placeholder="Digite o nome da cidade"
            style={{ marginLeft: 10 }}
          />
          <button onClick={buscarCidade} style={{ marginLeft: 5 }}>
            Buscar
          </button>
        </label>
      </div>

      <div
        id="map"
        style={{ width: "100%", height: 400, marginTop: 20, borderRadius: 10 }}
      ></div>

      <div style={{ marginTop: 20 }}>
        <label>
          Raio de alerta (km):
          <input
            type="number"
            value={raioAlerta}
            onChange={(e) => setRaioAlerta(Number(e.target.value))}
            min={1}
            max={500}
            style={{ marginLeft: 10, width: 60 }}
          />
        </label>

        <label style={{ marginLeft: 20 }}>
          Tipo de mapa:
          <select
            value={mapType}
            onChange={(e) => setMapType(e.target.value)}
            style={{ marginLeft: 10 }}
          >
            <option value="roadmap">Normal</option>
            <option value="satellite">Satélite</option>
          </select>
        </label>
      </div>

      <h2 style={{ marginTop: 30 }}>Histórico de focos de incêndio (últimos 7 dias)</h2>
      <div style={{ width: "100%", height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={historico}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="data" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="total" stroke="#FF0000" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: 20 }}>
        <button onClick={exportarCSV} style={{ marginRight: 10 }}>
          Exportar CSV
        </button>
        <button onClick={exportarPDF}>Exportar PDF</button>
      </div>

      <h3 style={{ marginTop: 30 }}>
        Estado mais crítico: <span style={{ color: "red" }}>{estadoMaisCritico}</span>
      </h3>
    </div>
  );
              }
