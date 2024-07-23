       $(document).ready(function() {
            M.AutoInit();

            const inputs = ['hitId'];
            let csvData = [];
            let csvFileName = '';

            $('#copyResults').hide();

            function clearInputs() {
                if (confirm('Are you sure you want to clear all inputs?')) {
                    inputs.forEach(input => {
                        $('#' + input).val('');
                    });
                    $('#workerIdList').empty().append('<option value="" disabled selected>Select the WorkerID</option>');
                    $('#asinSelect').empty().append('<option value="">Select an ASIN</option>');
                    $('#asinDetails, #textoutput').empty();
                    $('#copyResults').hide();
                    localStorage.clear();
                }
            }

            $('#csvFile').change(function(event) {
                const file = event.target.files[0];
                if (file) {
                    $('#progress').text('Loading...');
                    csvFileName = file.name;
                    $('#filePath').val(file.name);
                    Papa.parse(file, {
                        header: true,
                        complete: function(results) {
                            csvData = results.data;
                            $('#progress').text('Ready!');
                        },
                        error: function() {
                            $('#progress').text('Error loading file');
                        }
                    });
                }
            });

            function populateWorkerIdOptions() {
                const hitId = $('#hitId').val();
                const workerIdList = $('#workerIdList').empty().append('<option value="" disabled selected>Select the WorkerID</option>');

                const hitData = csvData.filter(row => row.HITId === hitId);
                const workerIds = [...new Set(hitData.map(row => row.WorkerId))];

                workerIds.forEach(workerId => {
                    workerIdList.append(`<option value="${workerId}">${workerId}</option>`);
                });
            }

            $('#hitId').on('input', populateWorkerIdOptions);

            $('#parseButton').click(function() {
                const hitId = $('#hitId').val();
                const workerId = $('#workerId').val();
                const hitData = csvData.filter(row => row.HITId === hitId);

                if (hitData.length === 0) {
                    alert('No data found for the given HITId');
                    return;
                }

                const workerData = hitData.find(row => row.WorkerId === workerId);

                if (!workerData) {
                    alert('No data found for the given WorkerId');
                    return;
                }

                $('#queryURL').text(workerData['Input.imageURL']);
                $('#jsonMatches').text(workerData['Input.matches']);
                $('#jsonInput').text(workerData['Answer.output_data']);

                const jsonInput = JSON.parse(workerData['Answer.output_data']);
                const jsonMatches = JSON.parse(workerData['Input.matches']);

                const asinSelect = $('#asinSelect').empty().append('<option value="">Select an ASIN</option>');

                jsonMatches.forEach(match => {
                    asinSelect.append(`<option value="${match.asin}">${match.asin}</option>`);
                });

                $('#asinSelectInput').on('input', function() {
                    const selectedAsin = $(this).val();
                    const asinDetails = $('#asinDetails').empty();

                    if (selectedAsin) {
                        const match = jsonMatches.find(m => m.asin === selectedAsin);
                        const answer = jsonInput[selectedAsin];
                        const keys = Object.keys(answer).filter(key => answer[key] === true);

                        asinDetails.html(`
                            <div style="display: flex; flex-direction: row;">
                                <img src="${workerData['Input.imageURL']}" alt="queryimage" style="width: 200px; height: auto; margin-right: 20px">
                                <div style="display: flex; flex-direction: column;">
                                    <p><b>ASIN: ${selectedAsin}</b></p>
                                    <img src="${match.image_url}" alt="${match.product_title}" style="width: 200px; height: auto;">
                                    <p>${match.product_title}</p>
                                </div>
                            </div>
                            <p>Selected choices: <b>${keys.join(', ')}</b></p>
                        `);

                        asinDetails.append(`
                            <textarea id="judged-${selectedAsin}" class="materialize-textarea" rows="3" placeholder="Enter your judgment here"></textarea>
                            <textarea id="comment-${selectedAsin}" class="materialize-textarea" rows="3" placeholder="Enter your explanation here"></textarea>
                            <button id="outputButton" class="btn blue">Output Final Text</button>
                        `);

                        $('#outputButton').click(function() {
                            $('#copyResults').show();
                            if (selectedAsin) {
                                const judged = $(`#judged-${selectedAsin}`).val();
                                const comment = $(`#comment-${selectedAsin}`).val();

                                const otherWorkerAnswers = hitData
                                    .filter(row => row.WorkerId !== workerId)
                                    .map(row => {
                                        const otherJsonInput = JSON.parse(row['Answer.output_data']);
                                        const otherAnswer = otherJsonInput[selectedAsin];
                                        const otherKeys = Object.keys(otherAnswer).filter(key => otherAnswer[key] === true);
                                        return `WorkerID ${row.WorkerId}: ${otherKeys.join(', ')}`;
                                    }).join(`\n`);

                                const finalText = `
<div>
<H3>Batch: ${csvFileName}</H3><br>
<H4>HITID: ${hitId}</H4><br>
<span>Query ImageURL: ${workerData['Input.imageURL']}</span><br>
<span>ASIN: "${selectedAsin}"</span><br>
<span>Image URL of "${selectedAsin}": ${match.image_url}</span><br>
<span>WorkerID ${workerId} chose "${keys.join(', ')}" however the correct answer is: "${judged}"</span><br>
<span>The other workers' answers are as follows:</span><br>
<span>${otherWorkerAnswers}</span><br>
<span>Explanation: ${comment}</span>
</div>
                                `;
                                $('#textoutput').html(finalText);
                            }
                        });
                    }
                });
            });

            $('#copyResults').click(function() {
                const textOutput = $('#textoutput').text();
                navigator.clipboard.writeText(textOutput).then(() => {
                    M.toast({ html: 'Results copied to clipboard' });
                }).catch(err => {
                    M.toast({ html: 'Failed to copy text: ' + err });
                });
            });

            $('#clearTextboxes').click(clearInputs);
        });