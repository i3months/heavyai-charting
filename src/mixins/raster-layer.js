import capMixin from "./cap-mixin"
import rasterLayerPointMixin from "./raster-layer-point-mixin"
import rasterLayerPolyMixin from "./raster-layer-poly-mixin"
import rasterLayerHeatmapMixin from "./raster-layer-heatmap-mixin"
import rasterLayerLineMixin from "./raster-layer-line-mixin"
import rasterLayerWindBarbMixin from "./raster-layer-windbarb-mixin"
import rasterLayerMesh2dMixin from "./raster-layer-mesh2d-mixin"
import rasterLayerCrossSectionTerrainMixin from "./raster-layer-cross-section-terrain-mixin"
import {
  createRasterLayerGetterSetter,
  createVegaAttrMixin
} from "../utils/utils-vega"
import { AABox2d, Point2d } from "@heavyai/draw/dist/draw"
import moment from "moment"
import { IMAGE_SIZE_LIMIT } from "../constants/dc-constants"
import { utils } from "../utils/utils"
import { IMAGE_EXTENSIONS } from "../constants/file-types"

const validLayerTypes = [
  "points",
  "polys",
  "heat",
  "lines",
  "windbarbs",
  "mesh2d",
  "crossSectionTerrain"
]

const { getImageSize, replaceAsync, parseUrlParts } = utils

export default function rasterLayer(layerType) {
  const _layerType = layerType

  let _dimension = null
  let _group = null
  let _mandatoryAttributes = []

  let _layer = capMixin({
    setDataAsync(callback) {
      // noop.
      // This is to appease mixins that require an object initialized with a baseMixin
    },

    data(callback) {
      // noop.
      // This is to appease mixins that require an object initialized with a baseMixin
    },

    filter() {
      // noop.
      // This is to appease mixins that require an object initialized with a baseMixin
    },

    _mandatoryAttributes(mandatoryAttributes) {
      // needed for layer mixins to control mandatory checks.

      if (!arguments.length) {
        return _mandatoryAttributes
      }
      _mandatoryAttributes = mandatoryAttributes
      return _layer
    }
  })

  _layer.othersGrouper(false) // TODO(croot): what does othersGrouper in capMixin do exactly?
  // Always set to false for now, tho user can override.

  if (layerType === "points") {
    _layer = rasterLayerPointMixin(_layer)
  } else if (layerType === "polys") {
    _layer = rasterLayerPolyMixin(_layer)
  } else if (/heat/.test(layerType)) {
    _layer = rasterLayerHeatmapMixin(_layer)
  } else if (layerType === "lines") {
    _layer = rasterLayerLineMixin(_layer)
  } else if (layerType === "windbarbs") {
    _layer = rasterLayerWindBarbMixin(_layer)
  } else if (layerType === "mesh2d") {
    _layer = rasterLayerMesh2dMixin(_layer)
  } else if (layerType === "crossSectionTerrain") {
    _layer = rasterLayerCrossSectionTerrainMixin(_layer)
  } else {
    throw new Error(
      '"' +
        layerType +
        '" is not a valid layer type. The valid layer types are: ' +
        validLayerTypes.join(", ")
    )
  }

  let _opacity = 1

  // NOTE: builds _layer.defaultFillColor(), _layer.nullFillColor(),
  //              _layer.fillColorScale(), & _layer.fillColorAttr()
  createVegaAttrMixin(_layer, "fillColor", "#22A7F0", "#CACACA", true)

  // NOTE: builds _layer.defaultStrokeColor(), _layer.nullStrokeColor(),
  //              _layer.strokeColorScale(), & _layer.strokeColorAttr()
  createVegaAttrMixin(_layer, "strokeColor", "white", "white", true)

  // NOTE: builds _layer.defaultStrokeWidth(), _layer.nullStrokeWidth(),
  //              _layer.strokeWidthScale(), & _layer.strokeWidthAttr()
  createVegaAttrMixin(_layer, "strokeWidth", 0, 0, true)

  _layer.popupColumns = createRasterLayerGetterSetter(_layer, [])
  _layer.popupColumnsMapped = createRasterLayerGetterSetter(_layer, {})
  _layer.popupFunction = createRasterLayerGetterSetter(_layer, null)
  _layer.popupStyle = createRasterLayerGetterSetter(_layer, {})
  _layer.densityAccumulatorEnabled = createRasterLayerGetterSetter(
    _layer,
    false
  )

  const _popup_wrap_class = "map-popup-wrap-new"
  const _popup_box_class = "map-popup-box-new"
  const _popup_item_copy_class = "popup-item-copy"
  const _popup_box_item_wrap_class = "map-popup-item-wrap"
  const _popup_box_image_class = "map-popup-image"
  const _popup_box_item_class = "map-popup-item"
  const _popup_item_key_class = "popup-item-key"
  const _popup_item_val_class = "popup-item-val"
  const _popup_content_attr = "data-copycontent"
  const _layerPopups = {}

  _layer.layerType = function() {
    return _layerType
  }

  /**
   * **mandatory**
   *
   * Set or get the dimension attribute of a chart. In `dc`, a dimension can be any valid [crossfilter
   * dimension](https://github.com/square/crossfilter/wiki/API-Reference#wiki-dimension).
   *
   * If a value is given, then it will be used as the new dimension. If no value is specified then
   * the current dimension will be returned.
   * @name dimension
   * @memberof dc.baseMixin
   * @instance
   * @see {@link https://github.com/square/crossfilter/wiki/API-Reference#dimension crossfilter.dimension}
   * @example
   * var index = crossfilter([]);
   * var dimension = index.dimension(dc.pluck('key'));
   * chart.dimension(dimension);
   * @param {crossfilter.dimension} [dimension]
   * @return {crossfilter.dimension}
   * @return {dc.baseMixin}
   */
  _layer.dimension = function(dimension) {
    if (!arguments.length) {
      return _dimension
    }
    _dimension = dimension
    return _layer
  }

  /**
   * **mandatory**
   *
   * Set or get the group attribute of a chart. In `dc` a group is a
   * {@link https://github.com/square/crossfilter/wiki/API-Reference#group-map-reduce crossfilter group}.
   * Usually the group should be created from the particular dimension associated with the same chart. If a value is
   * given, then it will be used as the new group.
   *
   * If no value specified then the current group will be returned.
   * If `name` is specified then it will be used to generate legend label.
   * @name group
   * @memberof dc.baseMixin
   * @instance
   * @see {@link https://github.com/square/crossfilter/wiki/API-Reference#group-map-reduce crossfilter.group}
   * @example
   * var index = crossfilter([]);
   * var dimension = index.dimension(dc.pluck('key'));
   * chart.dimension(dimension);
   * chart.group(dimension.group(crossfilter.reduceSum()));
   * @param {crossfilter.group} [group]
   * @param {String} [name]
   * @return {crossfilter.group}
   * @return {dc.baseMixin}
   */
  _layer.group = function(group, name) {
    if (!arguments.length) {
      return _group
    }
    _group = group
    _layer._groupName = name
    return _layer
  }

  _layer.opacity = function(opacity) {
    if (!arguments.length) {
      return _opacity
    }
    _opacity = opacity
    return _layer
  }

  function genHeatConfigFromChart(chart, layerName) {
    return {
      table: _layer.crossfilter().getDataSource(),
      width: Math.round(chart.width() * chart._getPixelRatio()),
      height: Math.round(chart.height() * chart._getPixelRatio()),
      min: chart.conv4326To900913(chart._minCoord),
      max: chart.conv4326To900913(chart._maxCoord),
      filter: _layer.crossfilter().getFilterString(layerName),
      globalFilter: _layer.crossfilter().getGlobalFilterString(),
      neLat: chart._maxCoord[1],
      zoom: chart.zoom()
    }
  }

  _layer.genVega = function(chart, layerName) {
    const cap = _layer.cap()
    const group = _layer.group() || {}
    let query = ""
    if (group.type === "dimension") {
      query = group.writeTopQuery(cap, undefined, true)
    } else if (group.type === "group") {
      query = group.writeTopQuery(cap, undefined, false, true)
    }

    if (!query.length) {
      // throw new Error("Crossfilter group/dimension did not provide a sql query string for layer " + layerName + "." + (groupType.length ? " Group type: " + (group.type || "unknown") + "." : ""))
    }

    if (_layer.type === "heatmap") {
      const vega = _layer._genVega({
        ...genHeatConfigFromChart(chart, layerName),
        layerName
      })
      return vega
    } else {
      const vega = _layer._genVega(chart, layerName, group, query)
      return vega
    }
  }

  _layer.hasPopupColumns = function() {
    const popCols = _layer.popupColumns()
    return Boolean(popCols && popCols instanceof Array && popCols.length > 0)
  }

  // A Utility function to map size or color measure label for custom measure popup
  // Label is the same as field most of the case but for custom measures, it could be different
  _layer.getMeasureLabel = function(measureRegex) {
    let measureBlock = null
    if (measureRegex[2] === "color" || measureRegex[2] === "strokeColor") {
      measureBlock = _layer.getState().encoding.color
    } else if (
      measureRegex[2] === "size" ||
      measureRegex[2] === "strokeWidth"
    ) {
      measureBlock = _layer.getState().encoding.size
    } else if (measureRegex[2] === "x" || measureRegex[2] === "y") {
      measureBlock = _layer.getState().encoding[measureRegex[2]]
    } else if (measureRegex[2] === "orientation") {
      measureBlock = _layer.getState().encoding.orientation
    }
    if (measureBlock && measureBlock.label) {
      return measureBlock.label
    }
    return measureBlock
  }

  function isMeasureCol(colAttr) {
    return (
      colAttr === "x" ||
      colAttr === "y" ||
      colAttr === "color" ||
      colAttr === "size" ||
      colAttr === "strokeColor" ||
      colAttr === "strokeWidth" ||
      colAttr === "orientation"
    )
  }

  function addPopupColumnToSet(colAttr, popupColSet) {
    // TODO(croot): getProjectOn for groups requires the two arguments,
    // dimension.getProjectOn() doesn't have any args.
    // Need to come up with a better API for group.getProjectOn()
    // and improve the api so that "as key0" are not automatically
    // added to those projection statements.

    // TODO(croot): performance could be improved here with a better
    // data structure, but probably not an issue given the amount
    // of popup col attrs to iterate through is small
    const dim = _layer.group() || _layer.dimension()
    if (
      dim ||
      _layer.layerType() === "points" ||
      _layer.layerType() === "lines" ||
      _layer.layerType() === "polys"
    ) {
      const projExprs =
        _layer.layerType() === "points" ||
        _layer.layerType() === "lines" ||
        _layer.layerType() === "polys" ||
        _layer.layerType() === ""
          ? _layer.getProjections()
          : dim.getProjectOn(true) // handles the group and dimension case
      const regex = /^\s*([\s\S]+)\s+as\s+(\S+)/i
      const funcRegex = /^\s*(\S+\s*\(.*\))\s+as\s+(\S+)/i
      for (let i = 0; i < projExprs.length; ++i) {
        const projExpr = projExprs[i]
        let regexRtn = projExpr.match(regex)
        if (regexRtn) {
          if (regexRtn[2] === colAttr) {
            if (isMeasureCol(colAttr)) {
              // column selector label is used for layer.popupColumns(), so we need to remove it from popupColSet for color/size or x/y measures
              const label = _layer.getMeasureLabel(regexRtn)
              popupColSet.delete(regexRtn[1])
              popupColSet.delete(label)
            } else {
              popupColSet.delete(colAttr)
            }

            colAttr = projExpr
            break
          }
        } else if (
          (regexRtn = projExpr.match(funcRegex)) &&
          regexRtn[2] === colAttr
        ) {
          popupColSet.delete(colAttr)
          colAttr = projExpr
          break
        } else if (projExpr && projExpr.replace(/^\s+|\s+$/g, "") === colAttr) {
          break
        }
      }
    }
    return popupColSet.add(colAttr.replace(/\n/g, " "))
  }

  _layer.getPopupAndRenderColumns = function(chart) {
    const popupColsSet = new Set()
    const popupCols = _layer.popupColumns()
    if (popupCols) {
      popupCols.forEach(colAttr => {
        addPopupColumnToSet(colAttr, popupColsSet)
      })
    }
    _layer._addRenderAttrsToPopupColumnSet(chart, popupColsSet)

    const rtnArray = []
    popupColsSet.forEach(colName => {
      rtnArray.push(colName)
    })
    return rtnArray
  }

  // this function maps hit testing response to popupColumns items
  function mapDataViaColumns(data, popupColumns, chart) {
    const newData = {}
    const columnSet = new Set(popupColumns)
    for (const key in data) {
      if (columnSet.has(key)) {
        newData[key] = data[key]
        data[key] instanceof Date ? moment(data[key]).utc() : data[key]

        if (typeof chart.useLonLat === "function" && chart.useLonLat()) {
          if (key === "x") {
            newData[key] = chart.conv900913To4326X(data[key])
          } else if (key === "y") {
            newData[key] = chart.conv900913To4326Y(data[key])
          }
        }
      } else {
        // check response key is size or measure column which is in popupColumns
        const dim = _layer.group() || _layer.dimension()
        const projExprs =
          _layer.layerType() === "points" ||
          _layer.layerType() === "lines" ||
          _layer.layerType() === "polys" ||
          _layer.layerType() === ""
            ? _layer.getProjections()
            : dim.getProjectOn(true)

        const regex = /^\s*([\s\S]+)\s+as\s+(\S+)/i
        for (let i = 0; i < projExprs.length; ++i) {
          const projExpr = projExprs[i]
          const regexRtn = projExpr.match(regex)
          // for custom columns, the column label is different than the column value,
          // so need to access the measure column label that is passed from immerse here
          const label = _layer.getMeasureLabel(regexRtn)
          if (columnSet.has(label)) {
            newData[label] = data[regexRtn[2]]
          }
        }
      }
    }
    return newData
  }

  _layer.areResultsValidForPopup = function(results) {
    if (!results) {
      return false
    }
    return _layer._areResultsValidForPopup(results[0])
  }

  function filenameHasExtension(url = "", extensions) {
    const urlParts = parseUrlParts(url)
    const hostAndPath = urlParts?.[5]
    return extensions.some(ext => hostAndPath?.toLowerCase()?.endsWith(ext))
  }

  const LinkElement = (href, content) =>
    `<a href="${href}" target="_blank" rel="noopener noreferrer">
    ${content}
    </a>`

  async function renderImageOrLink(chart, url, hyperlink, colVal) {
    // eslint-disable-next-line no-restricted-syntax
    try {
      const sizeBytes = await getImageSize(hyperlink)
      let urlContent = url
      if (sizeBytes > IMAGE_SIZE_LIMIT) {
        // eslint-disable-next-line no-console
        console.info(
          "Image too large to preview, falling back to hyperlink",
          hyperlink
        )
      } else if (!chart.popupImageEnabled || !chart.popupImageEnabled()) {
        // eslint-disable-next-line no-console
        console.info("Images preview for popups is disabled")
      } else {
        urlContent = `<img class="${_popup_box_image_class}" data-copycontent="${hyperlink}" src="${hyperlink}" alt="Image Preview">`
      }
      return Promise.resolve(LinkElement(hyperlink, urlContent), true)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        "Error creating image preview from column:",
        colVal,
        "Error:",
        e
      )
      return Promise.resolve(LinkElement(hyperlink, colVal), true)
    }
  }

  function replaceURL(chart, columnValue) {
    const urlRegExpr = /(((https?:\/\/)|(www\.))[^\s^<>'"”`]+)/g
    const urlMatch =
      typeof columnValue === "string" && columnValue.match(urlRegExpr)
    if (urlMatch) {
      return replaceAsync(columnValue, urlRegExpr, async url => {
        let hyperlink = url
        if (!hyperlink.match("^https?://")) {
          hyperlink = "http://" + hyperlink
        }
        if (filenameHasExtension(hyperlink, Object.values(IMAGE_EXTENSIONS))) {
          return renderImageOrLink(chart, hyperlink, url, columnValue)
        } else {
          return Promise.resolve(
            columnValue.replace(urlRegExpr, url => LinkElement(hyperlink, url)),
            true
          )
        }
      })
    } else {
      // Return raw column value, no transformation
      return Promise.resolve(columnValue)
    }
  }

  async function renderPopupHTML(
    chart,
    data,
    columnOrder,
    columnMap,
    formatMeasureValue
  ) {
    const formattedColumnPromises = columnOrder.map(key => {
      if (typeof data[key] === "undefined") {
        return ""
      }

      const columnKey = columnMap && columnMap[key] ? columnMap[key] : key
      const columnKeyTrimmed = columnKey.replace(/.*\((.*)\).*/, "$1")

      const columnValue = formatMeasureValue(data[key], columnKeyTrimmed)
      return replaceURL(chart, columnValue).then((formattedColumn, isLink) => {
        const columnHtml = `<div class="${_popup_box_item_class}">
            <span class="${_popup_item_key_class}">
              ${columnKey}:
            </span>
            <span class="${_popup_item_val_class}">
              ${formattedColumn}
            </span>
          </div>
        `
        return columnHtml
      })
    })
    return Promise.all(formattedColumnPromises).then(formattedColumns => {
      const html = `
        <div class="${_popup_item_copy_class}" title="Copy popup contents">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M10.6668 0.666748H2.66683C1.9335 0.666748 1.3335 1.26675 1.3335 2.00008V11.3334H2.66683V2.00008H10.6668V0.666748ZM10.0002 3.33341L14.0002 7.33341V14.0001C14.0002 14.7334 13.4002 15.3334 12.6668 15.3334H5.32683C4.5935 15.3334 4.00016 14.7334 4.00016 14.0001L4.00683 4.66675C4.00683 3.93341 4.60016 3.33341 5.3335 3.33341H10.0002ZM9.3335 8.00008H13.0002L9.3335 4.33341V8.00008Z"/>
          </svg>
        </div>
        <div class="${_popup_box_item_wrap_class}">
          ${formattedColumns.join("\n")}
        </div>
      `
      return html
    })
  }
  const getPopupContentForNode = node => {
    const imageElement =
      node.nodeType !== 3 /* just text */ &&
      node.getElementsByTagName("img")?.[0]
    if (imageElement) {
      // Copy the key and value, but use the data-popupcontent attribute for the image
      const wrapperElement = document.createElement("div")
      const valElement = document.createElement("span")
      valElement.setHTML(imageElement.getAttribute(_popup_content_attr))
      const keyElement = node.getElementsByClassName(_popup_item_key_class)?.[0]
      if (keyElement) {
        wrapperElement.appendChild(keyElement.cloneNode(true))
      }
      wrapperElement.appendChild(valElement)
      return wrapperElement
    } else {
      const textNode = document.createElement("span")
      textNode.appendChild(node.cloneNode(true))
      return textNode
    }
  }
  // Copy from popup content
  const copyPopupContent = () => {
    const copyRange = document.createRange()
    const nodesToCopy = document.getElementsByClassName(
      _popup_box_item_wrap_class
    )[0]?.childNodes

    if (!nodesToCopy || !nodesToCopy.length) {
      return
    }

    // Copies elements from popup to a new element, where it can grab specific
    // attributes or other content from the nodes
    const copyDummy = document.createElement("div")
    copyDummy.style.position = "fixed"
    // Copy the things
    nodesToCopy.forEach(node => {
      copyDummy.appendChild(getPopupContentForNode(node))
    })
    document.body.appendChild(copyDummy)
    copyRange.setStartBefore(copyDummy.childNodes[0])
    copyRange.setEndAfter(copyDummy.childNodes[copyDummy.childNodes.length - 1])
    window.getSelection().removeAllRanges()
    window.getSelection().addRange(copyRange)
    document.execCommand("copy")
    document.body.removeChild(copyDummy)
    window.getSelection().removeAllRanges()
  }

  _layer.displayPopup = function(
    chart,
    parentElem,
    result,
    minPopupArea,
    animate
  ) {
    // hit testing response includes color or size measure's result as "color" or "size"
    const data = result.row_set[0]

    // popupColumns have color or size measure label
    const popupColumns = _layer.popupColumns()
    const mappedColumns = _layer.popupColumnsMapped()
    const filteredData = mapDataViaColumns(data, popupColumns, chart)

    const width =
      typeof chart.effectiveWidth === "function"
        ? chart.effectiveWidth()
        : chart.width()
    const height =
      typeof chart.effectiveHeight === "function"
        ? chart.effectiveHeight()
        : chart.height()
    const margins =
      typeof chart.margins === "function"
        ? chart.margins()
        : { left: 0, right: 0, top: 0, bottom: 0 }

    const xscale = chart.x()
    const yscale = chart.y()

    const origXRange = xscale.range()
    const origYRange = yscale.range()

    xscale.range([0, width])
    yscale.range([0, height])

    const hoverSvgProps = {
      chart,
      parentElem,
      data,
      width,
      height,
      margins,
      xscale,
      yscale,
      minPopupArea,
      animate
    }

    const bounds = _layer._displayPopup(hoverSvgProps)

    // restore the original ranges so we don't screw anything else up
    xscale.range(origXRange)
    yscale.range(origYRange)

    const boundsCtr = AABox2d.getCenter(Point2d.create(), bounds)
    const overlapBounds = AABox2d.create(0, 0, width, height)
    AABox2d.intersection(overlapBounds, overlapBounds, bounds)

    if (AABox2d.isEmpty(overlapBounds)) {
      // there is no overlap with the two bounds, we should
      // never get here
      throw new Error(
        "Found a non-overlapping bounds for a pop-up shape and its parent div"
      )
    }

    const overlapSz = AABox2d.getSize(Point2d.create(), overlapBounds)
    const overlapCtr = AABox2d.getCenter(Point2d.create(), overlapBounds)

    const padding = 6 // in pixels TODO(croot): expose in css?
    let topOffset = 0

    const popupDiv = parentElem
      .append("div")
      .style({ left: boundsCtr[0] + "px", top: boundsCtr[1] + "px" })

    popupDiv.classed(_popup_wrap_class, true)

    // Puts it on a bit of a delay to avoid showing
    // it below a certain threshold. This flag determines if
    // popup promises have completed before this timeout block runs
    let alreadyLoaded = false
    setTimeout(() => {
      if (!alreadyLoaded) {
        // Add loader while we async determine the popup html
        popupDiv.classed("popup-loading", true)
        popupDiv
          .append("div")
          .attr("class", _popup_box_class)
          .style({ "min-width": "48px", "min-height": "48px" })
          .append("div")
          .classed("main-loading-icon", true)
          .style({ height: "32px", width: "32px" })
      }
    }, 300)

    _layerPopups[chart] = popupDiv

    if (animate) {
      popupDiv.classed("showPopup", true)
    }

    const popupData = _layer.popupFunction()
      ? _layer.popupFunction(filteredData, popupColumns, mappedColumns)
      : renderPopupHTML(
          chart,
          filteredData,
          popupColumns,
          mappedColumns,
          chart.measureValue
        )
    Promise.resolve(popupData)
      .then(popupHtml => {
        alreadyLoaded = true
        const popupContent = parentElem.select(`.${_popup_wrap_class}`)
        popupContent.classed("popup-loading", false)
        popupContent.selectAll("*").remove()
        const popupBox = popupContent
          .append("div")
          .attr("class", _popup_box_class)
          .html(popupHtml)
          .style("left", function() {
            const rect = d3
              .select(this)
              .node()
              .getBoundingClientRect()
            const boxWidth = rect.width
            const halfBoxWidth = boxWidth / 2
            const boxHeight = rect.height
            const halfBoxHeight = boxHeight / 2

            // check top first
            let left = 0
            let hDiff = 0,
              wDiff = 0

            if (
              overlapSz[0] >= boxWidth ||
              (boundsCtr[0] + halfBoxWidth < width &&
                boundsCtr[0] - halfBoxWidth >= 0)
            ) {
              left = boundsCtr[0] - overlapCtr[0]
              hDiff = overlapBounds[AABox2d.MINY] - boxHeight

              if (hDiff >= 0) {
                // can fit on top of shape and in the center of the shape horizontally
                topOffset = -(
                  boundsCtr[1] -
                  overlapBounds[AABox2d.MINY] +
                  Math.min(padding, hDiff) +
                  halfBoxHeight
                )
                return left + "px"
              }

              hDiff = overlapBounds[AABox2d.MAXY] + boxHeight
              if (hDiff < height) {
                // can fit on bottom and in the center of the shape horizontally
                topOffset =
                  overlapBounds[AABox2d.MAXY] -
                  boundsCtr[1] +
                  Math.min(padding, hDiff) +
                  halfBoxHeight
                return left + "px"
              }
            }

            if (
              overlapSz[1] >= boxHeight ||
              (boundsCtr[1] + halfBoxHeight < height &&
                boundsCtr[1] - halfBoxHeight >= 0)
            ) {
              topOffset = overlapCtr[1] - boundsCtr[1]

              wDiff = overlapBounds[AABox2d.MINX] - boxWidth
              if (wDiff >= 0) {
                // can fit on the left in the center of the shape vertically
                left = -(
                  boundsCtr[0] -
                  overlapBounds[AABox2d.MINX] +
                  Math.min(padding, wDiff) +
                  halfBoxWidth
                )
                return left + "px"
              }

              wDiff = overlapBounds[AABox2d.MAXX] + boxWidth
              if (wDiff < width) {
                // can fit on right in the center of the shape vertically
                left =
                  overlapBounds[AABox2d.MAXX] -
                  boundsCtr[0] +
                  Math.min(padding, wDiff) +
                  halfBoxWidth
                return left + "px"
              }
            }

            if (
              width - overlapSz[0] >= boxWidth &&
              height - overlapSz[1] >= boxHeight
            ) {
              // we can fit the popup box in the remaining negative space.
              // Let's figure out where exactly
              if (
                Math.abs(boxHeight - overlapSz[1]) <
                Math.abs(boxWidth - overlapSz[0])
              ) {
                hDiff = height - overlapSz[1] - boxHeight
                if (
                  overlapBounds[AABox2d.MINY] <
                  height - overlapBounds[AABox2d.MAXY]
                ) {
                  topOffset =
                    Math.min(padding, hDiff) + halfBoxHeight - boundsCtr[1]
                } else {
                  topOffset =
                    height -
                    Math.min(padding, hDiff) -
                    halfBoxHeight -
                    boundsCtr[1]
                }

                wDiff = overlapBounds[AABox2d.MINX] - boxWidth
                if (wDiff >= 0) {
                  // can fit on the left of the bounds
                  left = -(
                    boundsCtr[0] -
                    overlapBounds[AABox2d.MINX] +
                    Math.min(padding, wDiff) +
                    halfBoxWidth
                  )
                } else {
                  wDiff = overlapBounds[AABox2d.MAXX] + boxWidth
                  // can fit on right right of the bounds
                  left =
                    overlapBounds[AABox2d.MAXX] -
                    boundsCtr[0] +
                    Math.min(padding, wDiff) +
                    halfBoxWidth
                }
                return left + "px"
              } else {
                wDiff = width - overlapSz[0] - boxWidth
                if (
                  overlapBounds[AABox2d.MINX] <
                  width - overlapBounds[AABox2d.MAXX]
                ) {
                  left = Math.min(padding, wDiff) + halfBoxWidth - boundsCtr[0]
                } else {
                  left =
                    width -
                    Math.min(padding, wDiff) -
                    halfBoxWidth -
                    boundsCtr[0]
                }

                hDiff = overlapBounds[AABox2d.MINY] - boxHeight
                if (hDiff >= 0) {
                  // can fit on top of shape and in the center of the shape horizontally
                  topOffset = -(
                    boundsCtr[1] -
                    overlapBounds[AABox2d.MINY] +
                    Math.min(padding, hDiff) +
                    halfBoxHeight
                  )
                } else {
                  hDiff = overlapBounds[AABox2d.MAXY] + boxHeight
                  // can fit on bottom and in the center of the shape horizontally
                  topOffset =
                    overlapBounds[AABox2d.MAXY] -
                    boundsCtr[1] +
                    Math.min(padding, hDiff) +
                    halfBoxHeight
                }
                return left + "px"
              }
            }

            if (boxWidth * boxHeight < overlapSz[0] * overlapSz[1]) {
              // use the center of the overlapping bounds in the case where the box
              // can't fit anwhere on the outside
              topOffset = overlapCtr[1] - boundsCtr[1]
              left = overlapCtr[0] - boundsCtr[0]
            } else {
              // use the center of the screen
              topOffset = height / 2 - boundsCtr[1]
              left = width / 2 - boundsCtr[0]
            }
            return left + "px"
          })
          .style("top", () => topOffset + "px")

        const popupCopyIcon = document
          .getElementsByClassName(_popup_item_copy_class)
          .item(0)

        // eslint-disable-next-line no-unused-expressions
        popupCopyIcon?.addEventListener("click", () => {
          copyPopupContent()
        })

        _layerPopups[chart] = popupBox

        if (animate) {
          popupDiv.classed("showPopup", true)
        }
      })
      .catch(e => {
        alreadyLoaded = true
        // eslint-disable-next-line no-console
        console.warn("Error generating popup data", e)
      })
  }

  _layer.isPopupDisplayed = function(chart) {
    return _layerPopups[chart] !== undefined
  }

  _layer.hidePopup = function(chart, hideCallback) {
    if (_layerPopups[chart]) {
      const popup = chart.select(`.${_popup_wrap_class}:not(.popup-loading)`)
      if (popup) {
        popup.classed("removePopup", true).on("animationend", () => {
          delete _layerPopups[chart]
          hideCallback(chart)
        })
      }

      _layer._hidePopup(chart)
    }
  }

  _layer.destroyLayer = function(chart) {
    // need to define a "_destroyLayer" method for each
    // layer mixin
    _layer._destroyLayer(chart)
  }

  _layer._addQueryDrivenRenderPropToSet = function(setObj, markPropObj, prop) {
    if (typeof markPropObj[prop] !== "object") {
      return
    }

    if (typeof markPropObj[prop].field !== "string") {
      return
    }

    const queryAttr = markPropObj[prop].field
    addPopupColumnToSet(queryAttr, setObj)
    return setObj
  }

  return _layer
}
