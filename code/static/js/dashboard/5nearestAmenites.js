import {getUserLocation} from "../getUserlocation.js";
import {getAddressFromCoords} from "../routing.js";

let myChart; // Globale Variable für das Chart-Objekt


// Funktion zum Abrufen der nächsten Amenities
async function fetchNearestAmenities(lat, lon, amenityType, k) {
    return fetch('/nearest_amenities', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            lat: lat,
            lon: lon,
            amenity_type: amenityType,
            k: k
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Netzwerkantwort war nicht ok');
        }
        return response.json();
    })
    .then(async data => {
        const dataWithAddresses = await Promise.all( // Wartet, bis alle Adressen abgerufen wurden
            data.map(async item => {
                try {
                    const address = await getAddressFromCoords([item.coordinates[1], item.coordinates[0]]);
                    return { ...item, address }; // Fügt die Adresse zu den Daten hinzu und gibt sie zurück
                } catch (error) {
                    console.error('Fehler beim Abrufen der Adresse:', error);
                    return { ...item, address: 'Adresse nicht verfügbar' };
                }
            })
        );
        return dataWithAddresses; // Gibt die angereicherten Daten zurück
    });
}


// Funktion zum Erstellen des Diagramms
function createGeoBubbleChart(userLocation, data) {
    const canvas = document.getElementById('meinGeoBubbleChart');
    const ctx = canvas.getContext('2d');

    const size = Math.min(canvas.parentElement.offsetWidth, canvas.parentElement.offsetHeight);
    canvas.width = size;
    canvas.height = size;

    // Sortieren der Daten nach Distanz
    const sortedData = data.sort((a, b) => a.distance - b.distance);

    const bubbleChartData = {
        datasets: [{
            label: 'Nearest Amenities',
            data: sortedData.map((item, index) => ({
                x: (item.coordinates[0] - userLocation.lng) * 1000, // Skalierung der Longitude
                y: (item.coordinates[1] - userLocation.lat) * 1000, // Skalierung der Latitude
                r: 25 - index * 5, // Größe basierend auf dem Index in der sortierten Liste
                distance: item.distance, // Speichern der ursprünglichen Distanz
                address: item.address
            })),
            backgroundColor: 'rgba(0, 123, 255, 0.5)',
        }]
    };
    // Calculate maxRadius
    let maxRadius = Math.max(...bubbleChartData.datasets[0].data.map(d => Math.sqrt(d.x * d.x + d.y * d.y)));
    // Wenn ein Diagramm bereits existiert, wird es zerstört
    if (myChart) {
        myChart.destroy();
    }

    // Erstellen eines neuen Diagramms
    myChart = new Chart(ctx, {
        type: 'bubble',
        data: bubbleChartData,
        options: {
            maintainAspectRatio: true,
            responsive: true,
            scales: {
                x: {
                    display: false, // x-Achse ausblenden
                    type: 'linear',
                    position: 'bottom',
                    min: -maxRadius * 1.2, // Skaliert die Achse, damit Bubbles nicht überlappen
                    max: maxRadius * 1.2,
                    grid: {
                        display: false,
                    },
                    ticks: {
                        display: false,
                    }
                },
                y: {
                    display: false, // y-Achse ausblenden
                    type: 'linear',
                    min: -maxRadius * 1.2, // Skaliert die Achse, damit Bubbles nicht überlappen
                    max: maxRadius * 1.2,
                    grid: {
                        display: false,
                    },
                    ticks: {
                        display: false,
                    }
                }
            },
            plugins: {

                legend: {
                    display: false // Legende ausblenden
                },
                tooltip: {
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            let address = context.raw.address; // Adresse aus den Rohdaten extrahieren
                            let distance = context.raw.distance; // Distanz aus den Rohdaten extrahieren
                            return [`Adresse: ${address}`, `Distanz: ${distance.toFixed(2)} m`];
                        }
                    }
                }
            },
            elements: {
                point: {
                    radius: 0 // Punkte im Hintergrund ausblenden
                }
            }
        },
        plugins: [{
            beforeDatasetsDraw: chart => {
                let ctx = chart.ctx;
                ctx.save();
                let xAxis = chart.scales.x;
                let yAxis = chart.scales.y;
                let centerX = xAxis.getPixelForValue(0);
                let centerY = yAxis.getPixelForValue(0);
                let maxRadius = (Math.max(xAxis.width, yAxis.height) / 2); // Radius des größten Kreises

                ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'; // Standardfarbe für Linien

                // Zeichnen der Kreise
                let totalCircles = 6;
                for (let i = 1; i <= totalCircles; i++) {
                    let currentRadius = (i / totalCircles) * maxRadius;
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, currentRadius, 0, 2 * Math.PI);
                    ctx.stroke();
                }

                // Zeichnen der horizontalen Linie
                ctx.beginPath();
                ctx.moveTo(0, centerY);
                ctx.lineTo(chart.width, centerY);
                ctx.stroke();

                // Zeichnen der vertikalen Linie
                ctx.beginPath();
                ctx.moveTo(centerX, 0);
                ctx.lineTo(centerX, chart.height);
                ctx.stroke();

                // Hinzufügen der Himmelsrichtungen
                ctx.font = "20px";
                ctx.textAlign = "center";
                ctx.fillText("N", centerX, centerY - maxRadius - 10);
                ctx.fillText("S", centerX, centerY + maxRadius + 15);
                ctx.fillText("W", centerX - maxRadius - 15, centerY+4);
                ctx.fillText("O", centerX + maxRadius + 15, centerY+4);
            }
        }]


    });
}


// Funktion zum Abrufen der Daten und Anzeigen des Charts
function loadAndCreateChart(amenityType) {
    getUserLocation().then(userLocation => {
        fetchNearestAmenities(userLocation.lat, userLocation.lng, amenityType, 5)
            .then(data => {

                if (!Array.isArray(data)) {
                    throw new TypeError("Erwartete ein Array, erhielt aber: " + typeof data);
                }
                createGeoBubbleChart(userLocation, data);
            })
            .catch(error => {
                console.error('Fehler beim Laden der Daten:', error);
                // Zusätzliche Fehlerbehandlung hier
            });
    });
}


// Event-Listener für die Auswahl des Amenity-Typs
document.getElementById('amenitySelect2').addEventListener('change', function () {
    // Den ausgewählten Wert als Amenity setzen
    let selectedAmenity = this.value;

    // Diagramm mit dem ausgewählten Amenity aktualisieren
    loadAndCreateChart(selectedAmenity);
});


// Starten des Diagramms mit dem standardmäßig ausgewählten Amenity
loadAndCreateChart(document.getElementById('amenitySelect2').value);

