// =====================================================
// MONITORING SHELTER NAVIGASI
// MQTT + VISUAL SHELTER + SENSOR
// =====================================================


// =====================================================
// 1. KONFIGURASI MQTT
// =====================================================

const MQTT_HOST = "wss://broker.hivemq.com:8884/mqtt";

const MQTT_TOPIC =
    "ta/shelter_nav_2026/kelompok01/data";

const clientId =
    "web-shelter-" +
    Math.random().toString(16).substring(2, 10);


// =====================================================
// 2. KONFIGURASI SENSOR
// =====================================================

// GPIO 34 ESP32 menghasilkan ADC 0 - 4095
//
// Sementara kita gunakan:
//
// 0 - 1000     = NORMAL
// 1001 - 2500  = WASPADA
// > 2500       = GENANGAN

const WATER_WARNING = 1000;
const WATER_THRESHOLD = 2500;


// Suhu

const TEMP_NORMAL = 28;
const TEMP_WARNING = 32;


// =====================================================
// 3. DATA SENSOR
// =====================================================

let temperature = 0;
let humidity = 0;

let doorOpen = false;

let waterValue = 0;
let waterLevel = 0;

let alarmActive = false;

let mqttConnected = false;


// Untuk mencegah log yang sama muncul terus
let lastDoorState = null;
let lastWaterState = null;
let lastAlarmState = null;


// =====================================================
// 4. AMBIL ELEMENT HTML
// =====================================================

const temperatureEl =
    document.getElementById("temperature");

const humidityEl =
    document.getElementById("humidity");

const temperatureBar =
    document.getElementById("temperatureBar");

const humidityBar =
    document.getElementById("humidityBar");

const temperatureStatus =
    document.getElementById("temperatureStatus");

const humidityStatus =
    document.getElementById("humidityStatus");

const doorStatus =
    document.getElementById("doorStatus");

const waterStatus =
    document.getElementById("waterStatus");

const alarmPanel =
    document.getElementById("alarmPanel");

const alarmStatus =
    document.getElementById("alarmStatus");

const door =
    document.getElementById("door");

const doorAlert =
    document.getElementById("doorAlert");

const waterVisual =
    document.getElementById("waterVisual");

const beacon =
    document.getElementById("beacon");

const activityLog =
    document.getElementById("activityLog");

const lastUpdate =
    document.getElementById("lastUpdate");

const mqttStatus =
    document.getElementById("mqttStatus");

const acStatus =
    document.getElementById("acStatus");

const lampStatus =
    document.getElementById("lampStatus");

const buzzerStatus =
    document.getElementById("buzzerStatus");

const currentTime =
    document.getElementById("currentTime");

const currentDate =
    document.getElementById("currentDate");


// =====================================================
// 5. MQTT CONNECT
// =====================================================

addLog(
    "Menghubungkan dashboard ke MQTT...",
    "warning"
);


const mqttClient =
    mqtt.connect(MQTT_HOST, {

        clientId: clientId,

        clean: true,

        connectTimeout: 10000,

        reconnectPeriod: 3000

    });


// =====================================================
// 6. MQTT BERHASIL TERHUBUNG
// =====================================================

mqttClient.on("connect", function () {

    mqttConnected = true;

    console.log("MQTT TERHUBUNG");

    if (mqttStatus) {

        mqttStatus.textContent =
            "MQTT Connected";

        mqttStatus.style.color =
            "#2ee676";
    }


    mqttClient.subscribe(
        MQTT_TOPIC,
        function (error) {

            if (error) {

                console.error(
                    "Subscribe gagal:",
                    error
                );

                addLog(
                    "Subscribe MQTT gagal",
                    "danger"
                );

                return;
            }


            console.log(
                "Subscribe:",
                MQTT_TOPIC
            );


            addLog(
                "Dashboard terhubung ke ESP32 melalui MQTT",
                "safe"
            );

        }
    );

});


// =====================================================
// 7. MQTT ERROR
// =====================================================

mqttClient.on("error", function (error) {

    console.error(
        "MQTT Error:",
        error
    );

    mqttConnected = false;

    if (mqttStatus) {

        mqttStatus.textContent =
            "MQTT Error";

        mqttStatus.style.color =
            "#ff4b4b";
    }

    addLog(
        "Koneksi MQTT mengalami error",
        "danger"
    );

});


// =====================================================
// 8. MQTT OFFLINE
// =====================================================

mqttClient.on("offline", function () {

    mqttConnected = false;

    console.log("MQTT OFFLINE");

    if (mqttStatus) {

        mqttStatus.textContent =
            "MQTT Offline";

        mqttStatus.style.color =
            "#ff4b4b";
    }

    addLog(
        "MQTT offline - mencoba menghubungkan kembali",
        "warning"
    );

});


// =====================================================
// 9. MENERIMA DATA DARI ESP32
// =====================================================

mqttClient.on(
    "message",
    function (topic, message) {

        const payload =
            message.toString();


        console.log(
            "Data MQTT:",
            payload
        );


        // Format:
        //
        // suhu,kelembapan,pintu,air
        //
        // contoh:
        //
        // 27.5,61.2,1,850


        const data =
            payload.split(",");


        if (data.length < 4) {

            console.warn(
                "Format data MQTT salah:",
                payload
            );

            return;
        }


        // ---------------------------------------------
        // Baca data
        // ---------------------------------------------

        const suhu =
            parseFloat(data[0]);

        const kelembapan =
            parseFloat(data[1]);

        const pintu =
            parseInt(data[2]);

        const air =
            parseInt(data[3]);


        // ---------------------------------------------
        // Validasi
        // ---------------------------------------------

        if (
            isNaN(suhu) ||
            isNaN(kelembapan) ||
            isNaN(pintu) ||
            isNaN(air)
        ) {

            console.warn(
                "Data sensor tidak valid"
            );

            return;
        }


        // ---------------------------------------------
        // Simpan
        // ---------------------------------------------

        temperature =
            suhu;

        humidity =
            kelembapan;

        waterValue =
            air;


        // HIGH = pintu terbuka
        doorOpen =
            pintu === 1;


        // ---------------------------------------------
        // Hitung level air
        // ---------------------------------------------

        waterLevel =
            calculateWaterLevel(
                waterValue
            );


        // ---------------------------------------------
        // Update tampilan
        // ---------------------------------------------

        updateTemperature();

        updateHumidity();

        updateDoor();

        updateWater();

        updateAlarm();

        updateAC();

        updateLastUpdate();

        updateChart(
            temperature,
            humidity
        );


        console.log(
            "Suhu:",
            temperature
        );

        console.log(
            "Kelembapan:",
            humidity
        );

        console.log(
            "Pintu:",
            doorOpen
        );

        console.log(
            "Air:",
            waterValue
        );

    }
);


// =====================================================
// 10. KONVERSI NILAI AIR KE LEVEL
// =====================================================

function calculateWaterLevel(value) {

    if (value < WATER_WARNING) {

        return 0;
    }


    if (value < WATER_THRESHOLD) {

        // 1 - 20 cm
        return (
            5 +
            ((value - WATER_WARNING) /
            (WATER_THRESHOLD - WATER_WARNING))
            * 15
        );
    }


    // Jika > threshold
    // maksimum simulasi 35 cm

    let level =
        20 +
        ((value - WATER_THRESHOLD) / 1595)
        * 15;


    return Math.max(
        20,
        Math.min(35, level)
    );
}


// =====================================================
// 11. UPDATE SUHU
// =====================================================

function updateTemperature() {

    if (!temperatureEl) {
        return;
    }


    temperatureEl.textContent =
        temperature.toFixed(1) +
        " °C";


    // Bar maksimum 50°C

    let percentage =
        (temperature / 50) * 100;


    percentage =
        Math.max(
            0,
            Math.min(
                100,
                percentage
            )
        );


    if (temperatureBar) {

        temperatureBar.style.width =
            percentage + "%";
    }


    // STATUS

    if (
        temperature < TEMP_NORMAL
    ) {

        temperatureStatus.textContent =
            "NORMAL";

        temperatureStatus.className =
            "status-label safe";

    }

    else if (
        temperature <= TEMP_WARNING
    ) {

        temperatureStatus.textContent =
            "WASPADA";

        temperatureStatus.className =
            "status-label warning";

    }

    else {

        temperatureStatus.textContent =
            "BAHAYA";

        temperatureStatus.className =
            "status-label danger";
    }

}


// =====================================================
// 12. UPDATE KELEMBAPAN
// =====================================================

function updateHumidity() {

    if (!humidityEl) {
        return;
    }


    humidityEl.textContent =
        humidity.toFixed(1) +
        " %";


    let percentage =
        Math.max(
            0,
            Math.min(
                100,
                humidity
            )
        );


    if (humidityBar) {

        humidityBar.style.width =
            percentage + "%";
    }


    if (
        humidity <= 70
    ) {

        humidityStatus.textContent =
            "NORMAL";

        humidityStatus.className =
            "status-label safe";

    }

    else if (
        humidity <= 80
    ) {

        humidityStatus.textContent =
            "WASPADA";

        humidityStatus.className =
            "status-label warning";

    }

    else {

        humidityStatus.textContent =
            "TINGGI";

        humidityStatus.className =
            "status-label danger";
    }

}


// =====================================================
// 13. UPDATE PINTU
// =====================================================

function updateDoor() {

    if (!door) {
        return;
    }


    if (doorOpen) {

        // ---------------------------------------------
        // PINTU TERBUKA
        // ---------------------------------------------

        door.classList.add("open");


        if (doorAlert) {

            doorAlert.textContent =
                "⚠ PINTU TERBUKA";

            doorAlert.classList.add(
                "active"
            );
        }


        if (doorStatus) {

            doorStatus.textContent =
                "TERBUKA";

            doorStatus.className =
                "status-label danger";
        }


        // Hanya log ketika status berubah

        if (
            lastDoorState !== true
        ) {

            addLog(
                "Akses pintu TERBUKA",
                "danger"
            );
        }


        lastDoorState =
            true;

    }

    else {

        // ---------------------------------------------
        // PINTU TERTUTUP
        // ---------------------------------------------

        door.classList.remove(
            "open"
        );


        if (doorAlert) {

            doorAlert.textContent =
                "";

            doorAlert.classList.remove(
                "active"
            );
        }


        if (doorStatus) {

            doorStatus.textContent =
                "TERTUTUP";

            doorStatus.className =
                "status-label safe";
        }


        if (
            lastDoorState !== false
        ) {

            addLog(
                "Pintu shelter tertutup",
                "safe"
            );
        }


        lastDoorState =
            false;
    }

}


// =====================================================
// 14. UPDATE AIR
// =====================================================

function updateWater() {

    if (!waterVisual) {
        return;
    }


    // ============================================
    // NORMAL
    // ============================================

    if (
        waterValue < WATER_WARNING
    ) {

        waterVisual.classList.remove(
            "active"
        );


        waterVisual.style.opacity =
            "0";

        waterVisual.style.height =
            "10px";


        if (waterStatus) {

            waterStatus.textContent =
                "NORMAL";

            waterStatus.className =
                "status-label safe";
        }


        if (
            lastWaterState !== "normal"
        ) {

            addLog(
                "Kondisi lantai normal",
                "safe"
            );
        }


        lastWaterState =
            "normal";
    }


    // ============================================
    // WASPADA
    // ============================================

    else if (
        waterValue < WATER_THRESHOLD
    ) {

        waterVisual.classList.add(
            "active"
        );


        waterVisual.style.opacity =
            "0.55";


        waterVisual.style.height =
            Math.max(
                20,
                waterLevel * 1.5
            ) + "px";


        if (waterStatus) {

            waterStatus.textContent =
                "WASPADA";

            waterStatus.className =
                "status-label warning";
        }


        if (
            lastWaterState !== "warning"
        ) {

            addLog(
                "Kelembapan air mulai terdeteksi",
                "warning"
            );
        }


        lastWaterState =
            "warning";
    }


    // ============================================
    // GENANGAN
    // ============================================

    else {

        waterVisual.classList.add(
            "active"
        );


        waterVisual.style.opacity =
            "1";


        waterVisual.style.height =
            Math.max(
                35,
                waterLevel * 1.5
            ) + "px";


        if (waterStatus) {

            waterStatus.textContent =
                "TERDETEKSI";

            waterStatus.className =
                "status-label danger";
        }


        if (
            lastWaterState !== "danger"
        ) {

            addLog(
                "⚠ GENANGAN AIR TERDETEKSI",
                "danger"
            );
        }


        lastWaterState =
            "danger";
    }

}


// =====================================================
// 15. UPDATE ALARM
// =====================================================

function updateAlarm() {

    alarmActive =
        doorOpen ||
        waterValue >= WATER_THRESHOLD ||
        temperature > TEMP_WARNING;


    if (alarmActive) {

        if (alarmPanel) {

            alarmPanel.classList.add(
                "active"
            );
        }


        if (alarmStatus) {

            alarmStatus.textContent =
                "ALARM AKTIF";

            alarmStatus.className =
                "status-label danger";
        }


        if (beacon) {

            beacon.classList.add(
                "danger"
            );
        }


        if (buzzerStatus) {

            buzzerStatus.textContent =
                "ALARM";
        }


        if (
            lastAlarmState !== true
        ) {

            addLog(
                "🚨 ALARM SISTEM AKTIF",
                "danger"
            );
        }


        lastAlarmState =
            true;

    }

    else {

        if (alarmPanel) {

            alarmPanel.classList.remove(
                "active"
            );
        }


        if (alarmStatus) {

            alarmStatus.textContent =
                "NORMAL";

            alarmStatus.className =
                "status-label safe";
        }


        if (beacon) {

            beacon.classList.remove(
                "danger"
            );
        }


        if (buzzerStatus) {

            buzzerStatus.textContent =
                "STANDBY";
        }


        if (
            lastAlarmState !== false
        ) {

            addLog(
                "Sistem kembali NORMAL",
                "safe"
            );
        }


        lastAlarmState =
            false;
    }

}


// =====================================================
// 16. STATUS AC
// =====================================================

function updateAC() {

    if (!acStatus) {
        return;
    }


    // Untuk prototype,
    // AC dianggap aktif selama shelter online.

    if (mqttConnected) {

        acStatus.textContent =
            "AKTIF";

        acStatus.style.color =
            "#42e981";

    }

    else {

        acStatus.textContent =
            "OFFLINE";

        acStatus.style.color =
            "#ff4b4b";
    }

}


// =====================================================
// 17. LAST UPDATE
// =====================================================

function updateLastUpdate() {

    const now =
        new Date();


    if (lastUpdate) {

        lastUpdate.textContent =
            now.toLocaleTimeString(
                "id-ID"
            );
    }
}


// =====================================================
// 18. JAM REAL-TIME
// =====================================================

function updateClock() {

    const now =
        new Date();


    if (currentTime) {

        currentTime.textContent =
            now.toLocaleTimeString(
                "id-ID"
            );
    }


    if (currentDate) {

        currentDate.textContent =
            now.toLocaleDateString(
                "id-ID",
                {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                }
            );
    }

}


setInterval(
    updateClock,
    1000
);

updateClock();


// =====================================================
// 19. LOG AKTIVITAS
// =====================================================

function addLog(
    message,
    type = "safe"
) {

    if (!activityLog) {
        return;
    }


    const item =
        document.createElement(
            "div"
        );


    item.className =
        "log-item " +
        type;


    const time =
        new Date().toLocaleTimeString(
            "id-ID"
        );


    item.innerHTML = `

        <span>
            ${time}
        </span>

        <span>
            ${message}
        </span>

    `;


    activityLog.prepend(
        item
    );


    // Maksimum 20 log

    while (
        activityLog.children.length > 20
    ) {

        activityLog.removeChild(
            activityLog.lastChild
        );
    }

}


// =====================================================
// 20. MODE EXTERIOR
// =====================================================

function showExterior() {

    const exterior =
        document.getElementById(
            "exteriorView"
        );

    const interior =
        document.getElementById(
            "interiorView"
        );


    if (exterior) {

        exterior.classList.remove(
            "hidden"
        );
    }


    if (interior) {

        interior.classList.add(
            "hidden"
        );
    }


    const title =
        document.getElementById(
            "viewTitle"
        );


    if (title) {

        title.textContent =
            "EXTERIOR SHELTER";
    }


    updateViewButtons(
        0
    );


    addLog(
        "Kamera berpindah ke exterior shelter",
        "safe"
    );
}


// =====================================================
// 21. MODE INTERIOR
// =====================================================

function showInterior() {

    const exterior =
        document.getElementById(
            "exteriorView"
        );

    const interior =
        document.getElementById(
            "interiorView"
        );


    if (exterior) {

        exterior.classList.add(
            "hidden"
        );
    }


    if (interior) {

        interior.classList.remove(
            "hidden"
        );
    }


    const title =
        document.getElementById(
            "viewTitle"
        );


    if (title) {

        title.textContent =
            "INTERIOR SHELTER";
    }


    updateViewButtons(
        1
    );


    addLog(
        "Kamera masuk ke interior shelter",
        "safe"
    );
}


// =====================================================
// 22. UPDATE TOMBOL VIEW
// =====================================================

function updateViewButtons(
    activeIndex
) {

    const buttons =
        document.querySelectorAll(
            ".view-btn"
        );


    buttons.forEach(
        function (button, index) {

            if (
                index === activeIndex
            ) {

                button.classList.add(
                    "active"
                );

            }

            else {

                button.classList.remove(
                    "active"
                );
            }

        }
    );

}


// =====================================================
// 23. GRAFIK
// =====================================================

let sensorChart = null;

const chartCanvas =
    document.getElementById(
        "sensorChart"
    );


if (chartCanvas) {

    const ctx =
        chartCanvas.getContext(
            "2d"
        );


    sensorChart =
        new Chart(
            ctx,
            {

                type: "line",

                data: {

                    labels: [],

                    datasets: [

                        {

                            label:
                                "Suhu (°C)",

                            data: [],

                            borderWidth: 2,

                            tension: 0.35,

                            fill: false
                        },


                        {

                            label:
                                "Kelembapan (%)",

                            data: [],

                            borderWidth: 2,

                            tension: 0.35,

                            fill: false
                        }

                    ]

                },


                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    animation: false,

                    scales: {

                        x: {

                            ticks: {

                                color:
                                    "#70889e",

                                font: {
                                    size: 8
                                }

                            },

                            grid: {

                                color:
                                    "rgba(255,255,255,0.04)"
                            }
                        },


                        y: {

                            beginAtZero: true,

                            ticks: {

                                color:
                                    "#70889e",

                                font: {
                                    size: 8
                                }

                            },

                            grid: {

                                color:
                                    "rgba(255,255,255,0.04)"
                            }
                        }

                    },


                    plugins: {

                        legend: {

                            labels: {

                                color:
                                    "#9eb4c7",

                                font: {
                                    size: 9
                                }
                            }
                        }

                    }

                }

            }
        );
}


// =====================================================
// 24. UPDATE GRAFIK
// =====================================================

function updateChart(
    suhu,
    kelembapan
) {

    if (!sensorChart) {
        return;
    }


    const time =
        new Date().toLocaleTimeString(
            "id-ID"
        );


    sensorChart.data.labels.push(
        time
    );


    sensorChart.data.datasets[0]
        .data.push(
            suhu
        );


    sensorChart.data.datasets[1]
        .data.push(
            kelembapan
        );


    // Maksimum 20 titik

    if (
        sensorChart.data.labels.length > 20
    ) {

        sensorChart.data.labels.shift();

        sensorChart.data.datasets
            .forEach(
                function (dataset) {

                    dataset.data.shift();

                }
            );
    }


    sensorChart.update();
}


// =====================================================
// 25. STATUS AWAL
// =====================================================

if (acStatus) {

    acStatus.textContent =
        "STANDBY";
}

if (lampStatus) {

    lampStatus.textContent =
        "ON";
}

if (buzzerStatus) {

    buzzerStatus.textContent =
        "STANDBY";
}


addLog(
    "Dashboard monitoring dimulai",
    "safe"
);

addLog(
    "Menunggu data ESP32...",
    "warning"
);