'use strict';
import {
    axisLeft,
    geoPath,
    max,
    min,
    range,
    scaleLinear,
    scaleQuantize,
    schemeGreens,
    select,
    zoom,
} from 'd3';
import { feature, mesh } from 'topojson';

/* check #plot aspect-ration in CSS as well if you want to change it */
const plotWidth = 1000;
const plotHeight = 600;
const plotPadding = 60;

function fetchCounty() {
    return fetch(
        'https://cdn.freecodecamp.org/testable-projects-fcc/data/choropleth_map/counties.json'
    ).then((response) => response.json());
}

function fetchEducation() {
    return fetch(
        'https://cdn.freecodecamp.org/testable-projects-fcc/data/choropleth_map/for_user_education.json'
    ).then((response) => response.json());
}

function setPlotSize() {
    select('#plot').attr('viewBox', `0 0 ${plotWidth} ${plotHeight}`);
}

function handleMouseOver(event, { area_name, bachelorsOrHigher, state }) {
    const offset = 10;

    select('.tooltip')
        .html(
            `
            <span>${area_name}, ${state}: ${bachelorsOrHigher}</span>`
        )
        .style('top', `${event.clientY + offset}px`)
        .style('left', `${event.clientX + offset}px`)
        .attr('data-education', bachelorsOrHigher)
        .classed('hidden', false);
}

function handleMouseOut() {
    select('.tooltip').classed('hidden', true);
}

function getColorScale(data) {
    const maxEducationLevel = max(
        data,
        ({ bachelorsOrHigher }) => bachelorsOrHigher
    );
    const minEducationLevel = min(
        data,
        ({ bachelorsOrHigher }) => bachelorsOrHigher
    );
    const gradesCount = 8;

    return scaleQuantize()
        .domain([minEducationLevel, maxEducationLevel])
        .range(schemeGreens[gradesCount]);
}

function getScalingWrapper() {
    const wrapper = select('#plot').append('g');
    const scale = ({ transform }) => {
        wrapper.attr('transform', transform);
        wrapper.attr('stroke-width', 1 / transform.k);
    };

    select('#plot').call(
        zoom()
            .scaleExtent([1, 12])
            .translateExtent([
                [0, 0],
                [plotWidth, plotHeight],
            ])
            .on('zoom', scale)
    );

    return wrapper;
}

function renderMap(data, education, colorScale) {
    const mapToEducation = feature(data, data.objects.counties).features.map(
        (mapElement) => {
            return {
                ...mapElement,
                ...education.find(({ fips }) => fips === mapElement.id),
            };
        }
    );
    const wrapper = getScalingWrapper();

    wrapper
        .selectAll('path')
        .data(mapToEducation)
        .enter()
        .append('path')
        .attr('d', geoPath())
        .attr('fill', ({ bachelorsOrHigher }) => colorScale(bachelorsOrHigher))
        .attr('class', 'county')
        .attr('data-education', ({ bachelorsOrHigher }) => bachelorsOrHigher)
        .attr('data-fips', ({ fips }) => fips)
        .on('mouseover', (event, data) => handleMouseOver(event, data))
        .on('mouseout', handleMouseOut);

    wrapper
        .append('path')
        .datum(mesh(data, data.objects.states, (a, b) => a !== b)) // I don't understand this magic, it renders shapes of states
        .attr('class', 'states')
        .attr('d', geoPath());
}

function renderLegend(scaling) {
    const plot = select('#plot');
    const cellSize = 25;
    const cellsCount = scaling.range().length;
    const legendHeight = cellSize * cellsCount;

    plot.append('g')
        .attr('id', 'legend')
        .selectAll('legend')
        .data(scaling.range())
        .enter()
        .append('rect')
        .attr('x', plotWidth - plotPadding)
        .attr('y', (_, index) => plotHeight - plotPadding - cellSize * index)
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('fill', (color) => color);

    const [min, max] = scaling.domain();
    const xScale = scaleLinear().domain([min, max]).range([legendHeight, 0]);
    const yAxis = axisLeft(xScale)
        .tickValues(range(min, max, (max - min) / cellsCount).concat(max))
        .tickFormat((tick) => Math.round(tick) + '%');

    plot.append('g')
        .attr('id', 'legend-x-axis')
        .attr(
            'transform',
            `translate(${plotWidth - plotPadding}, ${
                plotHeight - plotPadding - legendHeight + cellSize
            })`
        )
        .call(yAxis);
}

setPlotSize();

Promise.all([fetchCounty(), fetchEducation()])
    .then(([map, education]) => {
        const colorScale = getColorScale(education);

        renderMap(map, education, colorScale);
        renderLegend(colorScale);
    })
    .catch((error) => {
        console.error('rendering failed:', error);
    });
