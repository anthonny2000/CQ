$(document).ready(function () {
    let csvData = [];
    let combinedData = [];
    const rowsPerPage = 25;
    let currentPage = 1;

    const csvFileInput = $('#csvFileInput');
    const copyTableButton = $('#copyTable');

    let headersToShow = ['SubmitDate', 'SubmitHour', 'HITId', 'AssignmentId', 'WorkerId', 'Input.imageURL', 'Input.config', 'Answer.data', 'Answer.query_intent', 'Input.bbox', 'Input.content', 'Input.marketplace', 'Answer.output_data', 'Input.matches'];
    let availableHeaders;

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    csvFileInput.on('change', debounce(handleFileInput, 300)).on('change', function () {
        $('#uploadProgress').text('File uploading...');
    });

    function handleFileInput(event) {
        const file = event.target.files[0];
        if (file) {
            Papa.parse(file, {
                header: true,
                dynamicTyping: true,
                complete: function (results) {
                    csvData = results.data;
                    currentPage = 1;
                    combinedData = csvData;
                    displayCSVData(combinedData);
                    updatePaginationControls();
                    $('#uploadProgress').text('Ready');
                },
                error: function (err) {
                    console.error("Error parsing CSV file:", err);
                    alert("Error parsing CSV file. Please try again.");
                }
            });
        }
    }

    function displayCSVData(data) {
        const firstRow = data[0] || {};
        availableHeaders = headersToShow.filter(header => header in firstRow || header === 'SubmitDate' || header === 'SubmitHour');

        if (availableHeaders.includes('Answer.data')) {
            availableHeaders.push('parsed_Answer.data');
        }
        if (availableHeaders.includes('Answer.output_data')) {
            availableHeaders.push('input.key', 'parsed_answer', 'parsed_image_url', 'parsed_title');
        }

        const headerRow = $('#csvTableHeader');
        const body = $('#csvTableBody');

        headerRow.empty();
        body.empty();

        availableHeaders.forEach(header => {
            headerRow.append(`<th>${header}</th>`);
        });

        const start = (currentPage - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        const pageData = data.slice(start, end);

        pageData.forEach(row => {
            appendTableRow(body, row, false);
        });

        updatePaginationControls();
    }

    function appendTableRow(body, row, forExport) {
        const asins = row['Answer.output_data'] ? Object.keys(JSON.parse(row['Answer.output_data'])) : [];
        const matches = row['Input.matches'] ? JSON.parse(row['Input.matches']) : [];

        if (asins.length > 0 && matches.length > 0) {
            asins.forEach(asin => {
                const match = matches.find(m => m.asin === asin) || {};
                const parsedAnswer = JSON.parse(row['Answer.output_data'])[asin];
                let parsedAnswerText = getParsedAnswerText(parsedAnswer);

                const rowElement = $('<tr></tr>');
                availableHeaders.forEach(header => {
                    let cellValue = getCellValue(row, header, asin, match, parsedAnswerText, forExport);
                    rowElement.append(`<td>${cellValue}</td>`);
                });
                body.append(rowElement);
            });
        } else {
            const rowElement = $('<tr></tr>');
            availableHeaders.forEach(header => {
                let cellValue = getCellValue(row, header, '', {}, '', forExport);
                rowElement.append(`<td>${cellValue}</td>`);
            });
            body.append(rowElement);
        }
    }

    function getParsedAnswerText(parsedAnswer) {
        return Object.entries(parsedAnswer).reduce((acc, [key, value]) => {
            if (!['link_clicked', 'on', 'purchase_availability'].includes(key)) {
                acc += `${key}: ${value}, `;
            }
            return acc;
        }, '').slice(0, -2);
    }

    function getCellValue(row, header, asin = '', match = {}, parsedAnswerText = '', forExport = false) {
        let cellValue = row[header] !== undefined ? row[header] : '';

        switch (header) {
            case 'SubmitDate':
                if (row['SubmitTime'] && typeof row['SubmitTime'] === 'string') {
                    return row['SubmitTime'].split('T')[0];
                } else if (row['SubmitTime']) {
                    return new Date(row['SubmitTime']).toISOString().split('T')[0];
                }
                return '';
            case 'SubmitHour':
                if (row['SubmitTime'] && typeof row['SubmitTime'] === 'string') {
                    return row['SubmitTime'].split('T')[1].split('+')[0];
                } else if (row['SubmitTime']) {
                    return new Date(row['SubmitTime']).toISOString().split('T')[1].split('.')[0];
                }
                return '';
            case 'Input.imageURL':
                return forExport ? cellValue : `<a href="${cellValue}" target="_blank" rel="noopener noreferrer">${cellValue}</a>`;
            case 'Input.config':
                return parseConfig(cellValue);
            case 'Answer.data':
                return parseAnswerData(row, cellValue);
            case 'parsed_Answer.data':
                return row[header] || 'nodata';
            case 'input.key':
                return asin;
            case 'parsed_answer':
                return parsedAnswerText;
            case 'parsed_image_url':
                return forExport ? match.image_url || '' : (match.image_url ? `<a href="${match.image_url}" target="_blank" rel="noopener noreferrer">${match.image_url}</a>` : '');
            case 'parsed_title':
                return match.product_title || '';
            default:
                return cellValue;
        }
    }

    function parseConfig(cellValue) {
        try {
            const config = JSON.parse(cellValue);
            return config.canvas?.imageURL || '';
        } catch (e) {
            return '';
        }
    }

    function parseAnswerData(row, cellValue) {
        try {
            const parsedData = JSON.parse(cellValue);
            row['parsed_Answer.data'] = parsedData.objects.map(obj => {
                return obj.data.map(dataEntry => `${dataEntry.name}: ${dataEntry.value}`).join(', ');
            }).join(' | ');
            return JSON.stringify(parsedData);
        } catch (e) {
            row['parsed_Answer.data'] = 'nodata';
            return row['Answer.data'];
        }
    }

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
            displayCSVData(combinedData);
        }
    }

    copyTableButton.on('click', () => {
        copyTableButton.text('Wait');
        const tableContent = generateTableContent();
        const blob = new Blob([tableContent], { type: 'text/tsv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Table_Output_${generateTimestamp()}.tsv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        copyTableButton.text('Export Table');
        alert('Export completed');
    });

    function generateTableContent() {
        let tableContent = availableHeaders.join('\t') + '\n';
        combinedData.forEach(row => {
            const asins = row['Answer.output_data'] ? Object.keys(JSON.parse(row['Answer.output_data'])) : [];
            const matches = row['Input.matches'] ? JSON.parse(row['Input.matches']) : [];

            if (asins.length > 0 && matches.length > 0) {
                asins.forEach(asin => {
                    const match = matches.find(m => m.asin === asin) || {};
                    const parsedAnswer = JSON.parse(row['Answer.output_data'])[asin];
                    let parsedAnswerText = getParsedAnswerText(parsedAnswer);

                    tableContent += availableHeaders.map(header => {
                        return getCellValue(row, header, asin, match, parsedAnswerText, true);
                    }).join('\t') + '\n';
                });
            } else {
                tableContent += availableHeaders.map(header => {
                    return getCellValue(row, header, '', {}, '', true);
                }).join('\t') + '\n';
            }
        });
        return tableContent;
    }

    function generateTimestamp() {
        const now = new Date();
        return now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + '_' +
            String(now.getHours()).padStart(2, '0') + '-' +
            String(now.getMinutes()).padStart(2, '0') + '-' +
            String(now.getSeconds()).padStart(2, '0');
    }
});
