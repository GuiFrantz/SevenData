document.getElementById("fileInput").addEventListener("change", () => {
    const fileInput = document.getElementById("fileInput");
    const output = document.getElementById("output");
    const resultsSection = document.getElementById("results");
    const downloadButton = document.getElementById("downloadButton");

    // Reset download button state on new file selection
    downloadButton.classList.add('opacity-90', 'cursor-not-allowed');
    downloadButton.onclick = null;

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
                const { processedContent } = processFileContent(content);

                placeholder.hidden = true;
                resultsSection.hidden = false;
                output.textContent = processedContent;
                output.hidden = false;

                // Enable download button
                downloadButton.classList.remove('opacity-50', 'cursor-not-allowed');
                downloadButton.onclick = () => downloadFile(processedContent, "analise_seven.txt");
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

        if (!lines.some(line => line.includes("S2: *E’Leclerc -"))) {
            throw new Error("O ficheiro de texto não possui o formato desejado.");
        }

        const monthlyTotalsFull = {};
        const dailyTotalsFull = {};
        const monthlyTotalsSum = {};
        const dailyTotalsSum = {};

        const dates = [];
        let currentDate = "";

        lines.forEach(line => {
            if (line.includes("S2: *E’Leclerc -") || line.includes("S2: *Seven Barbearia -")) {
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