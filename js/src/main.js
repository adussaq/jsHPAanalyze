/*global HPA $ jQuery ApexCharts*/
// let GLOBALTEST;
(function (glob) {
    "use strict";

    const headers_for_dashboard = [
        // {name: "Protein class", func: (x) => x.split(/\s*,\s*/)},
        // {name: "Antibody", func: (x) => x.split(/\s*,\s*/)}, too many unique options
        {name: "Subcellular location", func: (x) => x.split(/\s*,\s*/)},
        // {name: "Prognostic p-value", func: function (full_str) {
        //     return full_str.split(/\s*,\s*/).map(function (p_str) {
        //         //return p_str.split(/:/).shift();
        //         return p_str.replace(/\s*:\s*[\de\-\.]+/, "");
        //     });
        // }},
        // {name: "RNA cancer category", func: (x) => [x]},
        // {name: "RNA tissue category", func: (x) => [x]},
        // {name: "RNA TS", func: (x) => [x]},
        {name: "RNA tissue specific NX", func: (x) => x.replace(/\s*:\s*[\d\.]+/g, "").split(/\s*;\s*/)},
        //{name: "TPM max in non-specific", func: (x) => [x]},
        // {name: "RNA cell line category", func: (x) => [x]},
        //{name: "RNA CS", func: (x) => [x]},
        {name: "RNA cell line specific NX", func: (x) => x.replace(/\s*:\s*[\d\.]+/g, "").split(/\s*;\s*/)},
        {name: "Reliability (IH)", func: (x) => [x]},
        {name: "Reliability (Mouse Brain)", func: (x) => [x]},
        {name: "Reliability (IF)", func: (x) => [x]}
        // {name: "Gene", func: (x) => [x]}
    ];

    let stateChangeQueue;
    stateChangeQueue = function (key, funcOrStateArray, data) {
        let functions = {};
        stateChangeQueue = function (key, funcOrStateArray, data) {
            if (key === "exec") {
                Object.keys(functions).forEach(function (fname) {
                    functions[fname](funcOrStateArray, data);
                });
            } else {
                functions[key] = funcOrStateArray;
            }
        };
        stateChangeQueue(key, funcOrStateArray, data);
    };

    const parseTSV = function (text) {
        let arr = text
            .split('\n')
            .filter((x) => !x.match(/^\s*$/))
            .map((x) => x.split('\t'));

        const header = arr.shift().map((x) => x.replace(/"*/gi, ''));
        return {
            header: header,
            data: arr.map(function (row) {
                let obj = {};
                row.forEach(function (x, ind) {
                    obj[header[ind]] = x.replace(/"*/gi, '');
                });
                return obj;
            })
        };
    };

    const build_groups = function (data, state) {
        let counter = [];
        let thisdataFilter = data.data;
        if (state && state[state.length - 1] && state[state.length - 1].length) {
            thisdataFilter = thisdataFilter.filter((entry) => state[state.length - 1].indexOf(entry.Gene) + 1);
        }
        // console.log("thisdataFilter", thisdataFilter);

        // console.log(data, state);

        headers_for_dashboard.forEach(function (parse_obj, ind) {
            state[ind] = state[ind] || {};
            counter[ind] = counter[ind] || {};
            thisdataFilter.filter(function (entry) {
                let keep = true;
                state.forEach(function (state_obj, state_ind) {
                    // concept here:
                        // definitions
                            // Groups: 1, 2, 3, 4
                            // Filters: 1, 2, 3, 4
                            // Filter Lists: 1, 2, 3, 4
                                // 1: [valueX]
                            // Entries: 1,2,3,4,5,...,N
                                // Entry: 1: {group1: valueX}
                        // If Group #!= Filter # and Filter list # has some
                            // entries then we set to false unless the entry
                            // value for this group in this entry is in the
                            // aformentioned filter list
                    if (keep && state_ind !== ind && state_obj.selected && state_obj.selected.length) {
                        const match_check = entry[headers_for_dashboard[state_ind].name];
                        const match_check_arr = headers_for_dashboard[state_ind].func(match_check);
                        const good = match_check_arr.map(function (str) {
                            return state_obj.selected.indexOf(str);
                        }).reduce(function (a, b) {
                            if (isNaN(b)) {
                                return a;
                            }
                            return Math.max(a, b);
                        });
                        //// console.log(good, match_check_arr, state_obj.selected);
                        if (good < 0) {
                            keep = false;
                        }
                    }
                });
                return keep;
            }).forEach(function (entry, entry_ind) {
                // console.log(parse_obj, entry, entry[parse_obj.name], entry_ind);
                const parsed = parse_obj.func(entry[parse_obj.name]);
                parsed.forEach(function (elem) {
                    counter[ind][elem] = counter[ind][elem] || [];
                    counter[ind][elem].push(entry_ind);
                });
            });

            // if (ind > 2) {
            //     throw "No more for now...";
            // }
        });
        // console.log("here is counter", counter);
        // if (state[state.length -1].length) {
        //     counter.forEach(function (figList) {
        //         figList.
        //     });
        // }
        return {
            data: counter,
            header: headers_for_dashboard.map((x) => x.name)
        };
    };

    const getList = function (data, state, full) {
        let filterList = data.data;
        if (state && state[state.length - 1] && state[state.length - 1].length && !full) {
            filterList = data.data.filter(function (entry) {
                if (state[state.length - 1].indexOf(entry.Gene) >= 0) {
                    return true;
                }
                return false;
            });
        }
        return filterList.filter(function (entry) {
            let keep = true;
            headers_for_dashboard.forEach(function (parse_obj, ind) {
                if (keep && state[ind].selected.length) {
                    const match_check = entry[parse_obj.name];
                    const match_check_arr = parse_obj.func(match_check);
                    const good = match_check_arr.map(function (str) {
                        return state[ind].selected.indexOf(str);
                    }).reduce(function (a, b) {
                        if (isNaN(b)) {
                            return a;
                        }
                        return Math.max(a, b);
                    });
                    //// console.log(good, match_check_arr, state_obj.selected);
                    if (good < 0) {
                        keep = false;
                    }
                }
            });
            return keep;
        });
    };

    const format_num = function (num) {
        let str;
        if (num > 1000) {
            str = Math.floor(num).toString().replace(/\d{3}$/, "K");
        } else {
            str = num.toString();
        }
        return str;
    };

    const state_change = function (data, state_arr) {
        return function () {
            let groups = build_groups(data, state_arr);
            // console.log('changing states', groups, state_arr);
            state_arr.forEach(function (state_obj, state_ind) {
                if (state_obj.hasOwnProperty("chart")) {
                    state_obj.chart.dashboardUpdate(groups.data[state_ind]);
                }
            });
            stateChangeQueue("exec", state_arr, data);
        };
    };

    const barChart = function (data, title, $elem, state, state_change) {
        const sortKeys = function (a, b) {
            if (!b) {
                return 1;
            }
            if (!a) {
                return -1;
            }
            if (a > b) {
                return 1;
            }
            if (b > a) {
                return -1;
            }
            return 0;
        };
        const barSplits = function (keys, data) {
            let values = [{
                name: "Favourable",
                data: []
            }, {
                name: "Unfavourable",
                data: []
            }];
            let out = {data: values};

            //set keys
            let keyHash = {};
            keys.forEach(function (key) {
                if (key.match(/favourable/i)) { // will ignore undefined
                    keyHash[key.replace(/\s*\([^\)]*\)\s*/i, "")] = 1;
                }
            });
            out.labels = Object.keys(keyHash).sort(sortKeys);
            out.labels.forEach(function () {
                values[0].data.push(0);
                values[1].data.push(0);
            });

            keys.forEach(function (key) {
                const simpKey = key.replace(/\s*\([^\)]*\)\s*/i, "");
                out.labels.forEach(function (outKey, outInd) {
                    if (simpKey === outKey) {
                        if (key.match(/unfavourable/i)) {
                            values[1].data[outInd] = data[key].length;
                        } else if (key.match(/favourable/i)) {
                            values[0].data[outInd] = data[key].length;
                            //ignoring undefined
                        }
                    }
                });
            });
            return out;
        };

        let keys = Object.keys(data).sort(sortKeys);
        let chart;
        const splitObj = barSplits(keys, data);
        let labels = splitObj.labels;
        let values = splitObj.data;

        state.selected = state.selected || [];

        const clear_all = function () {
            let seriesIndex = 0;
            const $wrap = chart.w.globals.dom.elWrap;
            let elem = $wrap.querySelector('#apexcharts-donut-slice-' + seriesIndex);
            let legend = $wrap.querySelector('div[rel="' + (seriesIndex + 1) + '"].apexcharts-legend-series');

            const elemSelectStyle = 'stroke:black;stroke-dasharray:5,5;d:M5 20 l215 0;';
            const legendSelectStyle = 'font-weight:bold;';

            while (elem) {
                // get style elements
                let elemStyle = elem.getAttribute('style') || "";
                let legendStyle = legend.getAttribute('style') || "";

                //remove all style
                elem.setAttribute('style', elemStyle.replace(new RegExp(elemSelectStyle), ""));
                legend.setAttribute('style', legendStyle.replace(new RegExp(legendSelectStyle), ""));

                //update status
                seriesIndex += 1;
                elem = $wrap.querySelector('#apexcharts-donut-slice-' + seriesIndex);
                legend = $wrap.querySelector('div[rel="' + (seriesIndex + 1) + '"].apexcharts-legend-series');

            }
        };

        let toggle_select = function (seriesIndex, programmatic, groupIndex) {
            if (seriesIndex < 0) {
                return false;
            }
            let selected_key = labels[seriesIndex] + " (" + values[groupIndex].name.toLocaleLowerCase() + ")";
            // console.log(seriesIndex, selected_key, programmatic, groupIndex, labels);
            const $wrap = chart.w.globals.dom.elWrap;
            let elem = $wrap.querySelector('path[j="' + seriesIndex + '"][index="' + groupIndex + '"]');
            // console.log("toggle element", elem);
            //let legend = $wrap.querySelector('div[rel="' + (seriesIndex + 1) + '"].apexcharts-legend-series');

            const elemStyle = elem.getAttribute('style') || "";
            //const legendStyle = legend.getAttribute('style') || "";

            const elemSelectStyle = 'stroke:black;stroke-dasharray:5,5;d:M5 20 l215 0;';
            //const legendSelectStyle = 'font-weight:bold;';

            // delete from selected list (will add back in later if needed)
            if (programmatic) {
                state.selected = state.selected.filter((x) => x !== selected_key);
            }

            if (elemStyle.match(new RegExp(elemSelectStyle))) {
                elem.setAttribute('style', elemStyle.replace(new RegExp(elemSelectStyle), ""));
                //legend.setAttribute('style', legendStyle.replace(new RegExp(legendSelectStyle), ""));

                //remove from list
                state.selected = state.selected.filter((x) => x !== selected_key);
            } else {
                elem.setAttribute('style', elemStyle + ";" + elemSelectStyle);
                //legend.setAttribute('style', legendStyle + ";" + legendSelectStyle);

                // add to selected list
                state.selected.push(selected_key);
            }
            elem.setAttribute("data:pieClicked", "true");
            //update stuff
            if (!programmatic) {
                state_change();
            }
        };

        let options = {
            chart: {
                width: "100%",
                type: 'bar',
                events: {
                    dataPointSelection: function (event, chartContext, config) {
                        event.preventDefault();
                        toggle_select(config.dataPointIndex, false, config.seriesIndex, chartContext);
                    },
                    click: undefined,
                    beforeMount: undefined,
                    mounted: function () {
                        state.selected.forEach(function (key) {
                            // console.log("mounting per key", key);
                            let group = 0;
                            const sample = labels.indexOf(key.replace(/\s*\([^\)]*\)\s*/, ""));
                            if (key.match(/unfavou*rable/i)) {
                                group = 1;
                            }
                            toggle_select(sample, true, group);
                        });
                    },
                    updated: function (chartContext, config) {
                        //new data and data lables come in, update keys and
                            // re engaged the state
                        clear_all();
                        state.selected.forEach(function (key) {
                            let group = 0;
                            const sample = labels.indexOf(key.replace(/\s*\([^\)]*\)\s*/, ""));
                            // console.log("updating per key", key);
                            if (key.match(/unfavou*rable/i)) {
                                group = 1;
                            }
                            // console.log('found updated', key, group, sample, key.replace(/\s*\([^\)]*\)\s*/, ""));
                            toggle_select(sample, true, group, chartContext, config);
                        });
                    },
                    legendClick: function (chartContext, seriesIndex) {
                        toggle_select(seriesIndex, false, chartContext);
                    },
                    selection: undefined,
                    dataPointMouseEnter: undefined,
                    dataPointMouseLeave: undefined,
                    beforeZoom: undefined,
                    zoomed: undefined,
                    scrolled: undefined,
                    revertDataLabelsInner: undefined
                }
            },
            dataLabels: {
                enabled: false
            },
            series: values,
            xaxis: {categories: labels},
            yaxis: {title: {text: "Counts"}},
            file: {opacity: 1},

            responsive: [{
                breakpoint: 480,
                options: {
                    chart: {
                        width: "80%"
                        //height: 350
                    },
                    legend: {
                        show: false
                    }
                }
            }],
            legend: {
                position: 'bottom',
                offsetY: 0
               // height: 330
            },
            states: {
                normal: {
                    filter: {
                        type: 'none',
                        value: 0
                    }
                }
                // active: {
                //     allowMultipleDataPointsSelection: true,
                //     filter: {
                //         type: 'darken',
                //         value: 0.9
                //     }
                // }
            },
            plotOptions: {
                bar: {
                    horizontal: false,
                    columnWidth: "55%",
                    endingShape: "rounded"
                }
            },
            stroke: {
                show: true,
                width: 2,
                colors: ['transparent']
            }
        };
        let $title = document.createElement("h3");
        let $chartElem = document.createElement("div");
        $title.append(title);


        $elem.appendChild($title);
        $elem.appendChild($chartElem);

        chart = new ApexCharts($chartElem, options);

        chart.dashboardUpdate = function (new_data) {
            const newBarObj = barSplits(Object.keys(new_data), new_data);
            const new_keys = newBarObj.labels;
            const new_vals = newBarObj.data;

            // console.log('calling here...', newBarObj, new_data);

            let different = false;
            if (new_vals.length !== values.length) {
                different = true;
            }

            if (!different) {
                new_vals.forEach(function (obj, ind) {
                    if (obj.data.length !== values[ind].data.length) {
                        different = true;
                    }
                    if (!different) {
                        obj.data.forEach(function (val, dind) {
                            if (!different && val !== values[ind].data[dind]) {
                                different = true;
                            }
                        });
                    }
                });
            }

            if (different) {
                // // console.log("different", keys.slice(), new_keys.slice(), state);
                labels = new_keys;
                values = new_vals;

                chart.updateOptions({
                    series: values,
                    xaxis: {categories: labels}
                });
            }
        };

        return chart;
    };

    const donutChart = function (data, title, $elem, state, state_change) {
        const sortKeys = function (thisData) {
            return function (a, b) {
                if (!b) {
                    return -1;
                }
                if (!a) {
                    return 1;
                }
                return thisData[b].length - thisData[a].length;
            };
        };

        let keys = Object.keys(data).sort(sortKeys(data));
        let values = keys.map((key) => key === ""
            ? 1
            : data[key].length);
        let chart;

        state.selected = state.selected || [];

        const clear_all = function () {
            let seriesIndex = 0;
            const $wrap = chart.w.globals.dom.elWrap;
            let elem = $wrap.querySelector('#apexcharts-donut-slice-' + seriesIndex);
            let legend = $wrap.querySelector('div[rel="' + (seriesIndex + 1) + '"].apexcharts-legend-series');

            const elemSelectStyle = 'stroke:black;stroke-dasharray:5,5;d:M5 20 l215 0;';
            const legendSelectStyle = 'font-weight:bold;';

            while (elem) {
                // get style elements
                let elemStyle = elem.getAttribute('style') || "";
                let legendStyle = legend.getAttribute('style') || "";

                //remove all style
                elem.setAttribute('style', elemStyle.replace(new RegExp(elemSelectStyle), ""));
                legend.setAttribute('style', legendStyle.replace(new RegExp(legendSelectStyle), ""));

                //update status
                seriesIndex += 1;
                elem = $wrap.querySelector('#apexcharts-donut-slice-' + seriesIndex);
                legend = $wrap.querySelector('div[rel="' + (seriesIndex + 1) + '"].apexcharts-legend-series');

            }
        };

        let toggle_select = function (seriesIndex, programmatic) {
            if (seriesIndex < 0) {
                return false;
            }
            // console.log(seriesIndex, keys[seriesIndex], programmatic);
            const $wrap = chart.w.globals.dom.elWrap;
            let elem = $wrap.querySelector('#apexcharts-donut-slice-' + seriesIndex);
            let legend = $wrap.querySelector('div[rel="' + (seriesIndex + 1) + '"].apexcharts-legend-series');

            const elemStyle = elem.getAttribute('style') || "";
            const legendStyle = legend.getAttribute('style') || "";

            const elemSelectStyle = 'stroke:black;stroke-dasharray:5,5;d:M5 20 l215 0;';
            const legendSelectStyle = 'font-weight:bold;';

            // delete from selected list (will add back in later if needed)
            if (programmatic) {
                state.selected = state.selected.filter((x) => x !== keys[seriesIndex]);
            }

            if (elemStyle.match(new RegExp(elemSelectStyle))) {
                elem.setAttribute('style', elemStyle.replace(new RegExp(elemSelectStyle), ""));
                legend.setAttribute('style', legendStyle.replace(new RegExp(legendSelectStyle), ""));

                //remove from list
                state.selected = state.selected.filter((x) => x !== keys[seriesIndex]);
            } else {
                elem.setAttribute('style', elemStyle + ";" + elemSelectStyle);
                legend.setAttribute('style', legendStyle + ";" + legendSelectStyle);

                // add to selected list
                state.selected.push(keys[seriesIndex]);
            }
            elem.setAttribute("data:pieClicked", "true");
            //update stuff
            if (!programmatic) {
                state_change();
            }
        };

        let options = {
            noData: {
                text: undefined,
                align: 'center',
                verticalAlign: 'middle',
                offsetX: 0,
                offsetY: 0,
                style: {
                    color: undefined,
                    fontSize: '14px',
                    fontFamily: undefined
                }
            },
            chart: {
                width: "100%",
                type: 'donut',
                events: {
                    dataPointSelection: function (event, chartContext, config) {
                        event.preventDefault();
                        toggle_select(config.dataPointIndex, false, chartContext);
                    },
                    click: undefined,
                    beforeMount: undefined,
                    mounted: function () {
                        state.selected.forEach(function (key) {
                            toggle_select(keys.indexOf(key), true);
                        });
                    },
                    updated: function (chartContext, config) {
                        //new data and data lables come in, update keys and
                            // re engaged the state
                        clear_all();
                        state.selected.forEach(function (key) {
                            toggle_select(keys.indexOf(key), true, chartContext);
                        });
                    },
                    legendClick: function (chartContext, seriesIndex) {
                        toggle_select(seriesIndex, false, chartContext);
                    },
                    selection: undefined,
                    dataPointMouseEnter: undefined,
                    dataPointMouseLeave: undefined,
                    beforeZoom: undefined,
                    zoomed: undefined,
                    scrolled: undefined,
                    revertDataLabelsInner: undefined
                }
            },
            dataLabels: {
                enabled: false
            },
            series: values,
            labels: keys.map((key) => key !== ""
                ? key + " (" + format_num(data[key].length) + ")"
                : "Undefined (" + format_num(data[key].length) + ")"),
            responsive: [{
                breakpoint: 480,
                options: {
                    chart: {
                        width: "80%"
                        //height: 350
                    },
                    legend: {
                        show: false
                    }
                }
            }],
            legend: {
                position: 'right',
                offsetY: 0
               // height: 330
            },
            states: {
                normal: {
                    filter: {
                        type: 'none',
                        value: 0
                    }
                }
                // active: {
                //     allowMultipleDataPointsSelection: true,
                //     filter: {
                //         type: 'darken',
                //         value: 0.9
                //     }
                // }
            }
        };
        let $title = document.createElement("h3");
        let $chartElem = document.createElement("div");
        $title.append(title);


        $elem.appendChild($title);
        $elem.appendChild($chartElem);

        chart = new ApexCharts($chartElem, options);

        chart.dashboardUpdate = function (new_data) {
            const new_keys = Object.keys(new_data).sort(sortKeys(new_data));
            const new_vals = new_keys.map((key) => key === ""
                ? 1
                : new_data[key].length);

            let different = false;
            if (new_vals.length !== values.length || keys.length !== new_keys.length) {
                different = true;
            }

            if (!different) {
                new_vals.forEach(function (val, ind) {
                    if (!different && val !== values[ind]) {
                        different = true;
                    }
                });
            }

            if (!different) {
                new_keys.forEach(function (key, ind) {
                    if (!different && key !== keys[ind]) {
                        different = true;
                    }
                });
            }

            if (different) {
                // // console.log("different", keys.slice(), new_keys.slice(), state);
                keys = new_keys;
                values = new_vals;

                chart.updateOptions({
                    series: values,
                    labels: keys.map((key) => key !== ""
                        ? key + " (" + format_num(new_data[key].length) + ")"
                        : "Undefined (" + format_num(new_data[key].length) + ")")
                });
            }
        };

        return chart;
    };

    glob.get(/*No parameters gets it all in tsv*/).then(function (text) {
        // simply parse the tsv text
        return parseTSV(text);
    }).then(function (data) {
        //create donut chart for group one
        let state = [];
        let groups = build_groups(data, state);
        let $main = $('#main');
        $main.empty();
        $main.append("<h1>JS HPA Visualizer</h1>");
        $main.append('<p class="lead">Select elements of the subsequent charts then scroll to the bottom to click to create figures.</p>');
        let $row = $('<div>', {
            class: "row"
        }).appendTo($main);

        console.log("Data is loaded and grouped!", groups, data);
        // GLOBALTEST = [groups, data];

        groups.data.forEach(function (datum, ind) {
            let $div = $('<div>', {
                class: "col-sm-12 col-md-6"
            }).appendTo($row);

            if (groups.header[ind] === "Prognostic p-value") {
                state[ind].chart = barChart(datum, groups.header[ind], $div[0], state[ind], state_change(data, state, ind));
            } else {
                state[ind].chart = donutChart(datum, groups.header[ind], $div[0], state[ind], state_change(data, state, ind));
            }
            state[ind].chart.render();
        });

        state.push([]);

        let $geneListHeaders = $('<div>', {
            class: "row"
        }).appendTo($main);

        let $geneList = $('<div>', {
            class: "row",
            height: "300px"
        }).appendTo($main);

        let $geneButtonList = $('<div>', {
            class: "row"
        }).appendTo($main);

        let $infoList = $('<div>', {
            class: "row"
        }).appendTo($main);

        let $figures = $('<div>', {
            class: "row"
        }).appendTo($main);

        let $sampleNumber = $('<div>', {
            class: "col-12"
        }).appendTo($infoList);

        let $buttons = $('<div>', {
            class: "col-12"
        }).appendTo($infoList);

        const geneListFunc = function (states, data) {
            $geneListHeaders.html('<div class="col-6 h4">Potential Gene List</div><div class="col-6 h4">Selected Genes</div>');
            $geneList.empty();
            $geneButtonList.empty();

            let selectedGenes = states[states.length - 1];
            let tempSelected = {};
            let listRows;

            selectedGenes.forEach(function (gne) {
                tempSelected[gne] = 1;
            });

            // console.log("list genes", selectedGenes, state);

            let $posGene = $('<div>', {
                class: "col-xs-9 col-6",
                style: "overflow-y: scroll; height: 100%; border: 1px solid grey; border-radius: 5px;"
            });
            let $selectedGene = $('<div>', {
                class: "col-xs-3 col-6",
                style: "overflow-y: scroll; height: 100%; border: 1px solid grey; border-radius: 5px;"
            });

            let $addGene = $('<div>', {
                class: "col-12 text-center"
            }).append($('<button>', {
                class: 'btn btn-success',
                text: "Update lists"
            }));

            let $searchBar = $('<input type="text" class="form-control" aria-label="Default" aria-describedby="inputGroup-sizing-default">').change(function (evt) {
                console.log(evt, listRows);
                //respond to search
                const searchTerm = new RegExp(evt.target.value, 'i');
                listRows.forEach(function (row) {
                    if (evt.target.value.length > 0 && !row[1].match(searchTerm) && !row[0].attr('class').match(/gene-name-clicked/i)) {
                        row[0].hide();
                    } else {
                        row[0].show();
                    }
                });
            });

            let $searchBarSpace = $('<div class="col-12 input-group mb-3"></div>')
                .append('<div class="input-group-prepend"><span class="input-group-text" id="inputGroup-sizing-default">Filter lists by gene name</span></div>')
                .append($searchBar);

            $geneListHeaders.prepend('<p class="col-12"><small>Due to the large number of genes, searching may be slow, particularly when expanding the list. We recommend limiting with the figures above prior to searching here.</small></p>');
            $geneListHeaders.prepend($searchBarSpace);
            $geneList.append($posGene).append($selectedGene);

            $geneButtonList.append($addGene);

            let geneList = getList(data, states, true);

            // console.log("stuff here", geneList);

            const buildSides = function () {
                $posGene.empty();
                $selectedGene.empty();

                const leftClick = function (evt) {
                    evt.preventDefault();
                    if ($(this).attr('class') === 'gene-name-clicked') {
                        $(this).attr('class', 'gene-name');
                        tempSelected[$(this).text()] = 0;
                    } else {
                        $(this).attr('class', 'gene-name-clicked');
                        tempSelected[$(this).text()] = 1;
                    }
                };

                let rightClick = function (evt) {
                    evt.preventDefault();
                    if ($(this).attr('class') === 'gene-name-clicked') {
                        $(this).attr('class', 'gene-name');
                        tempSelected[$(this).text()] = 1;
                    } else {
                        $(this).attr('class', 'gene-name-clicked');
                        tempSelected[$(this).text()] = 0;
                    }
                };

                // console.log(tempSelected);
                listRows = geneList.map(function (entry) {
                    let $entry_examp;
                    if (!tempSelected[entry.Gene]) {
                        $entry_examp = $('<div>', {
                            class: "gene-name",
                            style: "width: 100%; border: 1px solid grey; border-radius: 5px;",
                            text: entry.Gene
                        }).click(leftClick);
                        $entry_examp.appendTo($posGene);
                    } else {
                        $entry_examp = $('<div>', {
                            class: "gene-name",
                            style: "width: 100%; border: 1px solid grey; border-radius: 5px;",
                            text: entry.Gene
                        }).click(rightClick);
                        $entry_examp.appendTo($selectedGene);
                    }
                    return [$entry_examp, entry.Gene];
                });
            };

            buildSides();

            $addGene.click(function (evt) {
                evt.preventDefault();
                states[states.length - 1] = Object.keys(tempSelected).filter((key) => tempSelected[key]);
                state_change(data, states)();
            });

        };

        stateChangeQueue("Gene List", geneListFunc);

        geneListFunc(state, data);

        stateChangeQueue("Sample Number", function (states, data) {
            let list = getList(data, states);
            $figures.empty();
            $sampleNumber.empty();
            $buttons.empty();
            // console.log('working on the update', states, data, list, list.map((x) => x["Prognostic p-value"]));
            $sampleNumber.text(list.length + " matched entries (Recommend no more than 50 entries, this will load slower the first time viewing data.)");


            // Patient Protein Expression Button
            $('<button>', {
                class: "btn btn-primary",
                style: "width: 30%; margin-right: 5%;",
                type: "button",
                text: "Build Figure: Patient Protein Expression"
            }).click(function (evt) {
                evt.preventDefault();
                $figures.empty();
                let $count = $('<div>').appendTo($figures);
                let count = 0;
                let total = list.length;
                // console.log(list);
                $count.html('<p class="lead">Loading beginning</p>');
                Promise.all(list.map(function (entry) {
                    return glob.get({ensembl: entry.Ensembl})
                        .then(function (res) {
                            count += 1;
                            $count.html('<p class="lead">Loaded: ' + count + ' / ' + total + '</p>');
                            if (count === total) {
                                $count.html('<p class="lead">Loaded: ' + count + ' / ' + total + '. Now creating figures, please wait.</p>');
                            }
                            return res;
                        });
                })).then(function (x) {
                    return new Promise(function (resolve) {
                        setTimeout(function () {
                            resolve(x);
                        }, 1000);
                    });
                }).then(function (tmp) {
                    $figures.empty();

                    //get all
                    const all = tmp.map(function (gene) {
                        return gene.proteinAtlas.entry;
                    });

                    const pt_perc = all.map(function (entry) {
                        if (entry.hasOwnProperty("antibody")) {
                            if (!Array.isArray(entry.antibody)) {
                                entry.antibody = [entry.antibody];
                            }
                            entry.antibody.sort(function (a, b) {
                                return b["@releaseVersion"] * 1 - a["@releaseVersion"] * 1;
                            });
                            let found;
                            entry.antibody.map(function (ant) {
                                if (!found && ant.hasOwnProperty("tissueExpression")) {
                                    found = ant.tissueExpression.filter((x) => x["@assayType"] === "pathology")[0];
                                }
                            });
                            if (found) {
                                return {anti: found.data, name: entry.name};
                            }
                            return found;
                        }
                        return;
                    }).filter((x) => x);
                    // console.log(all);
                    // console.log(pt_perc);

                    //build figure data
                    let figures = {};
                    let categories = [];

                    pt_perc.map(function (entry) {
                        categories.push(entry.name);
                        entry.anti.map(function (dat) {
                            if (dat.tissueCell.hasOwnProperty("level") && !Array.isArray(dat.tissueCell.level)) {
                                dat.tissueCell.level = [dat.tissueCell.level];
                            }
                            figures[dat.tissue] = figures[dat.tissue] || {
                                series: [
                                    {name: "Not Detected", data: []},
                                    {name: "Low", data: []},
                                    {name: "Medium", data: []},
                                    {name: "High", data: []}
                                ]
                            };
                            // console.log(dat.tissue, figures[dat.tissue], dat);
                            figures[dat.tissue].series.forEach((x) => x.data.push(0));
                            const ind = figures[dat.tissue].series[0].data.length - 1;
                            dat.tissueCell.level.forEach(function (count) {
                                if (count["#text"] === "high") {
                                    figures[dat.tissue].series[3].data[ind] = count["@count"] * 1;
                                } else if (count["#text"] === "medium") {
                                    figures[dat.tissue].series[2].data[ind] = count["@count"] * 1;
                                } else if (count["#text"] === "low") {
                                    figures[dat.tissue].series[1].data[ind] = count["@count"] * 1;
                                } else {
                                    figures[dat.tissue].series[0].data[ind] = count["@count"] * 1;
                                }
                            });
                        });
                    });

                    //Create figures
                    Object.keys(figures).map(function (figData) {
                        let options = {
                            chart: {
                                height: 350,
                                type: 'bar',
                                stacked: true,
                                stackType: '100%'
                            },
                            responsive: [{
                                breakpoint: 480,
                                options: {
                                    legend: {
                                        position: 'bottom',
                                        offsetX: -10,
                                        offsetY: 0
                                    }
                                }
                            }],
                            series: figures[figData].series,
                            xaxis: {
                                title: {
                                    text: "Genes"
                                },
                                categories: categories
                            },
                            yaxis: {
                                title: {
                                    text: "Percent of Patients"
                                }
                            },
                            title: {
                                text: figData
                            },
                            fill: {
                                opacity: 1
                            },
                            legend: {
                                position: 'bottom',
                                offsetX: 0,
                                offsetY: -5
                            }
                        };
                        let $fig = $('<div>', {
                            class: 'col col-xs-12 col-sm-6'
                        });
                        $fig.appendTo($figures);
                        // console.log(options);
                        let chart = new ApexCharts(
                            $fig[0],
                            options
                        );
                        chart.render();
                    });

                    // console.log(figures, categories);
                });
            }).appendTo($buttons);


            // Protein Expression in Tissue
            $('<button>', {
                class: "btn btn-primary col-4",
                type: "button",
                style: "width: 30%; margin-right: 5%;",
                text: "Build Figure: Protein Expression in Tissue"
            }).click(function (evt) {
                evt.preventDefault();
                $figures.empty();
                let $count = $('<div>').appendTo($figures);
                let count = 0;
                let total = list.length;
                // console.log(list);
                $count.html('<p class="lead">Loading beginning</p>');
                Promise.all(list.map(function (entry) {
                    return glob.get({ensembl: entry.Ensembl})
                        .then(function (res) {
                            count += 1;
                            $count.html('<p class="lead">Loaded: ' + count + ' / ' + total + '</p>');
                            if (count === total) {
                                $count.html('<p class="lead">Loaded: ' + count + ' / ' + total + '. Now creating figures, please wait.</p>');
                            }
                            return res;
                        });
                })).then(function (x) {
                    return new Promise(function (resolve) {
                        setTimeout(function () {
                            resolve(x);
                        }, 1000);
                    });
                }).then(function (tmp) {
                    $figures.empty();

                    //get all
                    const all = tmp.map(function (gene) {
                        return gene.proteinAtlas.entry;
                    });

                    //grab the genes with data
                    const pt_perc = all.map(function (entry) {
                        if (entry.hasOwnProperty("antibody")) {
                            if (!Array.isArray(entry.antibody)) {
                                entry.antibody = [entry.antibody];
                            }
                            entry.antibody.sort(function (a, b) {
                                return b["@releaseVersion"] * 1 - a["@releaseVersion"] * 1;
                            });
                            let found;
                            entry.antibody.map(function (ant) {
                                if (!found && ant.hasOwnProperty("tissueExpression")) {
                                    found = ant.tissueExpression.filter((x) => x["@assayType"] === "tissue")[0];
                                }
                            });

                            if (found) {
                                return {anti: found.data, name: entry.name};
                            }
                            return found;
                        }
                        return;
                    }).filter((x) => x);
                    // console.log(all, pt_perc);
                    // console.log(all);
                    // console.log(pt_perc);

                    //build figure data
                    let allTissues = {};
                    let figureDataInit = pt_perc.map(function (entry) {
                        let graphRow = {
                            name: entry.name
                        };

                        graphRow.data = {};
                        entry.anti.forEach(function (tissue) {
                            if (!Array.isArray(tissue.tissueCell)) {
                                tissue.tissueCell = [tissue.tissueCell];
                            }

                            tissue.tissueCell.forEach(function (each) {
                                //find ys
                                const ybegin = each.level.filter(function (x) {
                                    if (x["@type"] === "staining") {
                                        return true;
                                    }
                                    return false;
                                });

                                const ystr = ybegin[0]["#text"];

                                const ynum = ystr.match(/not\ detected/i)
                                    ? 1
                                    : ystr.match(/low/i)
                                        ? 2
                                        : ystr.match(/medium/i)
                                            ? 3
                                            : 4;
                                graphRow.data[tissue.tissue + " / " + each.cellType] = ynum;
                                allTissues[tissue.tissue + " / " + each.cellType] = 1;
                            });
                        });

                        return graphRow;
                    });

                    const allTissuesArr = Object.keys(allTissues).sort();
                    const figureDataTrans = figureDataInit.map(function (byGene) {
                        let retObj = {
                            name: byGene.name
                        };
                        retObj.data = allTissuesArr.map(function (tissueStr) {
                            if (byGene.data[tissueStr]) {
                                return {
                                    x: tissueStr,
                                    y: byGene.data[tissueStr]
                                };
                            }
                            return {
                                x: tissueStr,
                                y: 0
                            };
                        });
                        return retObj;
                    });

                    //transpose data
                    let figureData = [];
                    figureDataTrans.forEach(function (byGene, ind2) {
                        byGene.data.forEach(function (byTissue, ind_t) {
                            let ind1 = allTissuesArr.length - ind_t - 1;
                            figureData[ind1] = figureData[ind1] || {
                                name: byTissue.x,
                                data: []
                            };
                            figureData[ind1].data[ind2] = {
                                x: byGene.name,
                                y: byTissue.y
                            };
                        });
                    });

                    // console.log(figureData, figureDataInit);
                    let figHeight = 20 * figureData.length;
                    if (figHeight < 550) {
                        figHeight = 550;
                    }


                    //Create figure
                    (function () {
                        let options = {
                            chart: {
                                height: figHeight,
                                // width: "95%",
                                type: 'heatmap'
                            },
                            plotOptions: {
                                heatmap: {
                                    shadeIntensity: 0.5,
                                    colorScale: {
                                        ranges: [{
                                            from: -1,
                                            to: 0.1,
                                            name: 'No Data (0)',
                                            color: '#FFFFFF'
                                        }, {
                                            from: 0.1,
                                            to: 1.1,
                                            name: 'Not Detected (1)',
                                            color: '#00A100'
                                        }, {
                                            from: 1.1,
                                            to: 2.1,
                                            name: 'Low (2)',
                                            color: '#128FD9'
                                        }, {
                                            from: 2.1,
                                            to: 3.1,
                                            name: 'Medium (3)',
                                            color: '#FFB200'
                                        }, {
                                            from: 3.1,
                                            to: 4.1,
                                            name: 'High (4)',
                                            color: '#FF0000'
                                        }]
                                    }
                                }
                            },
                            yaxis: {
                                labels: {
                                    show: true,
                                    // offsetY: -40,
                                    offsetY: -8,
                                    rotate: -5,
                                    maxWidth: 400,
                                    style: {
                                        fontSize: "12px"
                                    }
                                }
                            },
                            dataLabels: {
                                enabled: false
                            },
                            series: figureData,
                            title: {
                                text: 'Protein Expression in Various Tissues'
                            }
                        };

                        let $fig = $('<div>', {
                            class: 'col-12'
                        });

                        $fig.appendTo($figures);

                        let chart = new ApexCharts(
                            $fig[0],
                            options
                        );
                        chart.render();
                    }());

                    // console.log(figures, categories);
                });
            }).appendTo($buttons);

            // Protein Expression in Tissue
            $('<button>', {
                class: "btn btn-primary col-4",
                type: "button",
                style: "width: 30%;",
                text: "Build Figure: Subcellular Localization By Protein"
            }).click(function (evt) {
                evt.preventDefault();
                $figures.empty();
                let $count = $('<div>').appendTo($figures);
                let count = 0;
                let total = list.length;
                // console.log(list);
                $count.html('<p class="lead">Loading beginning</p>');
                Promise.all(list.map(function (entry) {
                    return glob.get({ensembl: entry.Ensembl})
                        .then(function (res) {
                            count += 1;
                            $count.html('<p class="lead">Loaded: ' + count + ' / ' + total + '</p>');
                            if (count === total) {
                                $count.html('<p class="lead">Loaded: ' + count + ' / ' + total + '. Now creating figures, please wait.</p>');
                            }
                            return res;
                        });
                })).then(function (x) {
                    return new Promise(function (resolve) {
                        setTimeout(function () {
                            resolve(x);
                        }, 1000);
                    });
                }).then(function (tmp) {
                    $figures.empty();

                    //get all
                    const all = tmp.map(function (gene) {
                        return gene.proteinAtlas.entry;
                    });

                    // console.log(all);

                    //grab the genes with data
                    const pt_perc = all.map(function (entry) {
                        if (entry.hasOwnProperty("cellExpression")) {
                            let found = entry.cellExpression;

                            if (found && found.hasOwnProperty('data')) {
                                found = found.data;
                            } else {
                                found = false;
                            }

                            if (found && found.hasOwnProperty('location')) {
                                found = found.location;
                                if (!Array.isArray(found)) {
                                    found = [found];
                                }
                            } else {
                                found = false;
                            }

                            if (found && found.length > 0) {
                                return {anti: found.map((x) => x["#text"]), name: entry.name};
                            }
                            return found;
                        }
                        return;
                    }).filter((x) => x);
                    console.log(all, pt_perc);
                    // console.log(all);
                    // console.log(pt_perc);

                    //build figure data
                    let allTissues = {};
                    let figureDataInit = pt_perc.map(function (entry) {
                        let graphRow = {
                            name: entry.name
                        };

                        graphRow.data = {};
                        entry.anti.forEach(function (loc) {
                            graphRow.data[loc] = 1;
                            allTissues[loc] = 1;
                        });

                        return graphRow;
                    });

                    const allTissuesArr = Object.keys(allTissues).sort();
                    const figureDataTrans = figureDataInit.map(function (byGene) {
                        let retObj = {
                            name: byGene.name
                        };
                        retObj.data = allTissuesArr.map(function (tissueStr) {
                            if (byGene.data[tissueStr]) {
                                return {
                                    x: tissueStr,
                                    y: byGene.data[tissueStr]
                                };
                            }
                            return {
                                x: tissueStr,
                                y: 0
                            };
                        });
                        return retObj;
                    });

                    //transpose data
                    let figureData = [];
                    figureDataTrans.forEach(function (byGene, ind2) {
                        byGene.data.forEach(function (byTissue, ind_t) {
                            let ind1 = allTissuesArr.length - ind_t - 1;
                            figureData[ind1] = figureData[ind1] || {
                                name: byTissue.x,
                                data: []
                            };
                            figureData[ind1].data[ind2] = {
                                x: byGene.name,
                                y: byTissue.y
                            };
                        });
                    });

                    // console.log(figureData, figureDataInit);

                    let figHeight = 20 * figureData.length;
                    if (figHeight < 550) {
                        figHeight = 550;
                    }

                    //Create figure
                    (function () {
                        let options = {
                            chart: {
                                height: figHeight,
                                // width: "95%",
                                type: 'heatmap'
                            },
                            plotOptions: {
                                heatmap: {
                                    shadeIntensity: 0.5,
                                    colorScale: {
                                        ranges: [{
                                            from: -1,
                                            to: 0.1,
                                            name: 'No Expression (0)',
                                            color: '#FFFFFF'
                                        }, {
                                            from: 0.1,
                                            to: 1.1,
                                            name: 'Expression (1)',
                                            color: '#000000'
                                        }]
                                    }
                                }
                            },
                            yaxis: {
                                labels: {
                                    show: true,
                                    // offsetY: -40,
                                    offsetY: -8,
                                    rotate: -5,
                                    maxWidth: 400,
                                    style: {
                                        fontSize: "12px"
                                    }
                                }
                            },
                            dataLabels: {
                                enabled: false
                            },
                            series: figureData,
                            title: {
                                text: 'Protein Expression in Various Subcellular Locations'
                            }
                        };

                        let $fig = $('<div>', {
                            class: 'col-12'
                        });

                        $fig.appendTo($figures);

                        let chart = new ApexCharts(
                            $fig[0],
                            options
                        );
                        chart.render();
                    }());

                    // console.log(figures, categories);
                });
            }).appendTo($buttons);

        });
    }).catch(console.error);
}(HPA));