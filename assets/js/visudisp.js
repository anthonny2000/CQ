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

$(document).ready(function() {
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
        const dataMap = new Map();

        data.forEach(row => {
            const key = row.HITId + row["Input.imageURL"] + row["Input.marketplace"] + row["Input.content"];
            if (!dataMap.has(key)) {
                dataMap.set(key, {
                    HITId: row.HITId,
                    Input_imageURL: row["Input.imageURL"],
                    Input_marketplace: row["Input.marketplace"],
                    Input_content: row["Input.content"],
                    WorkerId_count: new Set(),
                    Attribute_counts: initializeAttributeCounts(),
                    ASINS: new Set(),
                    Image_status: 'Loading...',
                    Participation: 0,
                    Highest_attribute_ratio: 0
                });
            }
            const outputData = parseJSON(row["Answer.output_data"]);
            const record = dataMap.get(key);
            for (const asin in outputData) {
                attributes.forEach(attr => {
                    if (outputData[asin][attr]) record.Attribute_counts[attr]++;
                });
                record.ASINS.add(asin);
            }
            record.WorkerId_count.add(row.WorkerId);
        });

        combinedData = Array.from(dataMap.values()).map(record => {
            record.WorkerId_count = record.WorkerId_count.size;
            record.ASINS = record.ASINS.size;
            record.Participation = record.WorkerId_count;
            record.Highest_attribute_ratio = Math.max(...Object.values(record.Attribute_counts)) / record.Participation;
            return record;
        });

        renderTable();
        updatePaginationControls();
        validateImageUrls();
    }

    function initializeAttributeCounts() {
        const counts = {};
        attributes.forEach(attr => counts[attr] = 0);
        return counts;
    }

    function parseJSON(data) {
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error("Invalid JSON in Answer.output_data", data);
            return {};
        }
    }

    // Render table with pagination
    function renderTable() {
        const tableHeader = $("#csvTableHeader");
        const tableBody = $("#csvTableBody");
        tableHeader.empty();
        tableBody.empty();

        const headers = [
            "HITId", "Input_imageURL", "Input_marketplace", "Input_content", "WorkerId_count", "Image_status", ...attributes, "ASINS", "Participation", "Highest_attribute_ratio"
        ];

        headers.forEach(header => tableHeader.append($(`<th>${header}</th>`)));

        const start = (currentPage - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        const pageData = combinedData.slice(start, end);

        pageData.forEach(row => {
            const rowElement = $("<tr></tr>");
            headers.forEach(key => {
                if (attributes.includes(key)) {
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

    // Validate Image URLs
    function validateImageUrls() {
        let imagesProcessed = 0;
        const totalImages = combinedData.length;
        $('#progressContainer').removeClass('d-none');

        combinedData.forEach((record, index) => {
            const img = new Image();
            img.onload = () => {
                updateImageStatus(index, 'valid');
                renderTable();
            };
            img.onerror = () => {
                updateImageStatus(index, 'invalid');
                renderTable();
            };
            img.src = record.Input_imageURL;
        });

        function updateImageStatus(index, status) {
            combinedData[index].Image_status = status;
            imagesProcessed++;
            updateProgress(imagesProcessed, totalImages);
            if (imagesProcessed === totalImages) {
                console.log('All images have been processed.');
                $('#progressContainer').addClass('d-none');
                renderTable();
            }
        }
    }

    function updateProgress(processed, total) {
        const progress = (processed / total) * 100;
        $('#progressBar').css('width', `${progress}%`);
        $('#progressText').text(`${processed}/${total} Images Treated`);
    }

    // Copy Table to TSV
    $('#copyTable').on('click', function() {
        copyTableToTSV();
    });

    function copyTableToTSV() {
        let tsvContent = '';
        const headers = [
            "HITId", "Input_imageURL", "Input_marketplace", "Input_content", "WorkerId_count", "Image_status", ...attributes, "ASINS", "Participation", "Highest_attribute_ratio"
        ];
        
        // Add headers to TSV
        tsvContent += headers.join("\t") + "\n";

        // Add rows to TSV
        combinedData.forEach(row => {
            let rowArray = [];
            headers.forEach(key => {
                if (attributes.includes(key)) {
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
});
