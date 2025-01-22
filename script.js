document.getElementById("fileInput").addEventListener("change", () => {
    const fileInput = document.getElementById("fileInput");
    const output = document.getElementById("output");
    const resultsSection = document.getElementById("results");
    const downloadButton = document.getElementById("downloadButton");
    const chart = document.getElementById("chart");

    if (fileInput.files.length === 0) {
        alert("Por favor selecione um ficheiro '.zip'");
        return;
    }

    const file = fileInput.files[0];

    const reader = new FileReader();
    reader.onload = function (e) {
        const zip = new JSZip();

        zip.loadAsync(file)
            .then(zipContents => {
                const chatFile = zipContents.file("_chat.txt");
                if (!chatFile) {
                    throw new Error("Não conseguimos encontrar o ficheiro '_chat.txt' dentro do ficheiro ZIP");
                }

                return chatFile.async("string");
            })
            .then(content => {
                const { processedContent, dailyTotalsFull } = processFileContent(content);

                // Display the results
                resultsSection.hidden = false;
                output.textContent = processedContent;
                chart.hidden = false;
                output.hidden = false;

                // Enable download
                downloadButton.hidden = false;
                downloadButton.onclick = () => downloadFile(processedContent, "analise_seven.txt");

                // Render the graph
                renderGraph(dailyTotalsFull);
            })
            .catch(error => {
                alert(error.message);
            });
    };

    reader.onerror = function () {
        alert("Falha ao ler o ficheiro");
    };

    reader.readAsArrayBuffer(file);
});

function processFileContent(inputFileContent) {
    try {
        const lines = inputFileContent.split('\n');

        if (!lines.some(line => line.includes("Tio Jr S2: *E’Leclerc -"))) {
            throw new Error("O ficheiro de texto não possui o formato desejado.\n\n[Não conseguimos encontrar a linha 'Tio Jr S2: *E’Leclerc -']");
        }

        const monthlyTotalsFull = {};
        const dailyTotalsFull = {};
        const monthlyTotalsSum = {};
        const dailyTotalsSum = {};

        const dates = [];
        let currentDate = "";

        lines.forEach(line => {
            if (line.includes("Tio Jr S2: *E’Leclerc -")) {
                currentDate = line.split("- ")[1].replace("*", "").trim();
                dates.push(currentDate);
            }

            if (line.includes("Retirada =") || line.includes("Ratirada =")) {
                try {
                    const retiradaValue = parseFloat(
                        line.split("=")[1].trim().replace("€", "").replace("*", "").replace(",", ".")
                    );

                    const [day, month, year] = currentDate.split("/").map(Number);

                    const monthKey = `${year}-${month}`;
                    const dayKey = `${year}-${month}-${day}`;

                    if (!monthlyTotalsFull[monthKey]) monthlyTotalsFull[monthKey] = 0;
                    if (!dailyTotalsFull[dayKey]) dailyTotalsFull[dayKey] = 0;

                    monthlyTotalsFull[monthKey] += retiradaValue;
                    dailyTotalsFull[dayKey] += retiradaValue;

                    if (!monthlyTotalsSum[month]) monthlyTotalsSum[month] = 0;
                    if (!dailyTotalsSum[day]) dailyTotalsSum[day] = 0;

                    monthlyTotalsSum[month] += retiradaValue;
                    dailyTotalsSum[day] += retiradaValue;
                } catch (error) {
                    console.error(`Error ao processar linha: ${line.trim()}`);
                }
            }
        });

        const startDate = dates[0] || "Não há datas disponíveis";
        const stopDate = dates[dates.length - 1] || "Não há datas disponíveis";
        const dateRange = `de ${startDate} a ${stopDate}`;

        const lastMonthYear = Object.keys(monthlyTotalsFull).sort().pop();

        const output = [];
        output.push("RESULTADO COMPLETO\n");
        output.push(`${dateRange}\n\n`);
        output.push("--------------------\n");

        if (lastMonthYear) {
            const [lastYear, lastMonth] = lastMonthYear.split("-");
            output.push(`Último Mês (${lastMonth.padStart(2, '0')}/${lastYear}):\n`);
            output.push(`Total:\n- €${monthlyTotalsFull[lastMonthYear].toFixed(2)}\n\n`);
            output.push("Diário:\n");

            for (const dayKey in dailyTotalsFull) {
                if (dayKey.startsWith(lastMonthYear)) {
                    const [year, month, day] = dayKey.split("-").map(Number);
                    output.push(`- ${day}: €${dailyTotalsFull[dayKey].toFixed(2)}\n`);
                }
            }
        }

        output.push("--------------------\n\nTotal mensal:\n");
        for (const monthKey of Object.keys(monthlyTotalsFull)
            .sort((a, b) => new Date(`${b}-01`) - new Date(`${a}-01`)).reverse()) {
            const [year, month] = monthKey.split("-");
            output.push(`- ${month.padStart(2, '0')}/${year}: €${monthlyTotalsFull[monthKey].toFixed(2)}\n`);
        }

        output.push("\nTotal diário:\n");
        for (const dayKey of Object.keys(dailyTotalsFull)
            .sort((a, b) => new Date(b) - new Date(a)).reverse()) {
            const [year, month, day] = dayKey.split("-").map(Number);
            output.push(`- ${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}: €${dailyTotalsFull[dayKey].toFixed(2)}\n`);
        }

        return {
            processedContent: output.join(''),
            dailyTotalsFull,
            dailyTotalsSum,
        };
    } catch (error) {
        throw new Error(error.message);
    }
}

function downloadFile(content, filename) {
    const blob = new Blob([content], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function renderGraph(dailyTotalsFull, dailyTotalsSum) {
    const ctx = document.getElementById("dailyGraph").getContext("2d");

    // Get the last month and year from the dailyTotalsFull keys
    const lastMonthYear = Object.keys(dailyTotalsFull).sort().pop();
    const [lastYear, lastMonth] = lastMonthYear.split("-");

    // Filter dailyTotalsFull for the last month
    const lastMonthData = {};
    for (const dayKey in dailyTotalsFull) {
        if (dayKey.startsWith(`${lastYear}-${lastMonth}`)) {
            lastMonthData[dayKey] = dailyTotalsFull[dayKey];
        }
    }

    // Calculate the mean values for the same days in all years
    const meanValues = {};
    for (const dayKey in dailyTotalsFull) {
        const [year, month, day] = dayKey.split("-").map(Number);
        if (month === Number(lastMonth)) {
            if (!meanValues[day]) meanValues[day] = [];
            meanValues[day].push(dailyTotalsFull[dayKey]);
        }
    }

    const meanValuesForLastMonth = Object.keys(lastMonthData).map(dayKey => {
        const day = Number(dayKey.split("-")[2]);
        const values = meanValues[day] || [];
        const sum = values.reduce((acc, val) => acc + val, 0);
        return values.length ? sum / values.length : 0;
    });

    const labels = Object.keys(lastMonthData).map(dayKey => {
        const [year, month, day] = dayKey.split("-").map(part => part.padStart(2, '0'));
        return `${day}/${month}`;
    });

    const dailyAmounts = Object.values(lastMonthData);

    new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Valor Diário",
                    data: dailyAmounts,
                    borderColor: "#1e7e34",
                    borderWidth: 2,
                    fill: false,
                },
                {
                    label: "Média Diária",
                    data: meanValuesForLastMonth,
                    borderColor: "#BF3939",
                    borderDash: [5, 5],
                    borderWidth: 2,
                    fill: false,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: "Último mês em retrospectiva",
                },
            },
            scales: {
                x: {
                    title: { display: true, text: "Dia" },
                },
                y: {
                    title: { display: true, text: "Valor (€)" },
                },
            },
        },
    });
}