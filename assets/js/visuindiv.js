const attributes = [
    "asin_image_not_load", "no_difference", "wrong_age_group", "wrong_category", 
    "color", "pattern", "design", "material", "size", "shape", "surface_placement", 
    "support_type", "extra_features", "location", "has_product_difference", 
    "is_wrong_characteristic", "is_wrong_size_or_count", "is_wrong_bundle", 
    "is_wrong_packaging_overlay", "is_non_targeted_match"
];

let currentPage = 1;
const rowsPerPage = 25;
let combinedData = [];

// Handle CSV file upload
$("#csvFileInput").on("change", function(event) {
    const file = event.target.files[0];
    if (file) {
        Papa.parse(file, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: "greedy",
            complete: function(results) {
                processData(results.data);
            }
        });
    }
});

// Process CSV data
function processData(data) {
    combinedData = data.filter(row => row.HITId && row["Input.imageURL"] && row["Answer.output_data"]).map(row => {
        let outputData;
        try {
            outputData = JSON.parse(row["Answer.output_data"]);
        } catch (e) {
            console.error("Invalid JSON in Answer.output_data", row["Answer.output_data"]);
            outputData = {};
        }
        let counts = {};
        attributes.forEach(attr => counts[attr] = 0);

        for (const asin in outputData) {
            attributes.forEach(attr => {
                if (outputData[asin][attr]) counts[attr]++;
            });
        }

        return {
            HITId: row.HITId,
            Input_imageURL: row["Input.imageURL"],
            Input_marketplace: row["Input.marketplace"],
            Answer_output_data: row["Answer.output_data"], // Keep original JSON as is
            Input_content: row["Input.content"],
            Attribute_counts: counts, // New variable for attribute counts
            Input_matches: row["Input.matches"], // Plain text version of Input.matches
            WorkerId: row.WorkerId,
            worktime: row.worktime,
            ASINS: Object.keys(outputData).length,
            WorkerId_Count: countWorkerIds(data, row.HITId)
        };
    });

    renderTable();
    updatePaginationControls();
}

// Count unique WorkerIds for a given HITId
function countWorkerIds(data, HITId) {
    const workerIds = data.filter(row => row.HITId === HITId).map(row => row.WorkerId);
    return new Set(workerIds).size;
}

// Render table with pagination
function renderTable() {
    const tableHeader = $("#csvTableHeader");
    const tableBody = $("#csvTableBody");
    tableHeader.empty();
    tableBody.empty();

    const headers = [
        "HITId", "Input_imageURL", "Input_marketplace", "Input_content", "Answer_output_data", 
        "Input_matches", "WorkerId", "worktime", ...attributes, "ASINS", "WorkerId_Count"
    ];

    headers.forEach(header => tableHeader.append($(`<th>${header}</th>`)));

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = combinedData.slice(start, end);

    pageData.forEach(row => {
        const rowElement = $("<tr></tr>");
        headers.forEach(key => {
            if (key === "Answer_output_data" || key === "Input_matches") {
                rowElement.append($(`<td>${row[key] ? row[key] : ''}</td>`));
            } else if (attributes.includes(key)) {
                rowElement.append($(`<td>${row.Attribute_counts[key]}</td>`));
            } else {
                rowElement.append($(`<td>${row[key] !== undefined ? row[key] : ''}</td>`));
            }
        });
        tableBody.append(rowElement);
    });
}

// Pagination controls
function updatePaginationControls() {
    const totalPages = Math.ceil(combinedData.length / rowsPerPage);
    $('#pageInfo').text(`Page ${currentPage} of ${totalPages}`);
    $('#prevPage').prop('disabled', currentPage === 1);
    $('#nextPage').prop('disabled', currentPage === totalPages);
}

$('#prevPage').on('click', () => changePage(currentPage - 1));
$('#nextPage').on('click', () => changePage(currentPage + 1));
$('#beginPage').on('click', () => changePage(1));
$('#endPage').on('click', () => changePage(Math.ceil(combinedData.length / rowsPerPage)));
$('#jumpToPage').on('click', () => {
    const totalPages = Math.ceil(combinedData.length / rowsPerPage);
    const targetPage = parseInt($('#jumpToPageInput').val(), 10);
    if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
        changePage(targetPage);
    } else {
        alert('Invalid page number.');
    }
});

function changePage(page) {
    if (page >= 1 && page <= Math.ceil(combinedData.length / rowsPerPage)) {
        currentPage = page;
        renderTable();
        updatePaginationControls();
    }
}

    // Copy Table to TSV
    $('#copyTable').on('click', function() {
        copyTableToTSV();
    });

    function copyTableToTSV() {
        let tsvContent = '';
        const headers = [
            "HITId", "Input_imageURL", "Input_marketplace", "Input_content", "Answer_output_data", 
            "Input_matches", "WorkerId", "worktime", ...attributes, "ASINS", "WorkerId_Count"
        ];
        
        // Add headers to TSV
        tsvContent += headers.join("\t") + "\n";

        // Add rows to TSV
        combinedData.forEach(row => {
            let rowArray = [];
            headers.forEach(key => {
                if (key === "Answer_output_data" || key === "Input_matches") {
                    rowArray.push(row[key] ? row[key] : '');
                } else if (attributes.includes(key)) {
                    rowArray.push(row.Attribute_counts[key]);
                } else {
                    rowArray.push(row[key] !== undefined ? row[key] : '');
                }
            });
            tsvContent += rowArray.join("\t") + "\n";
        });

        // Create a filename
        const filename = `TSVOutput-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.tsv`;

        // Trigger download
        downloadTSV(tsvContent, filename);
    }

    function downloadTSV(tsvContent, filename) {
        const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
        const link = document.createElement("a");

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }