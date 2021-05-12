var canvas = null
var context = null

var color_state = null //is static
var output_color_state = null
var output_index_state = null
var new_color_state = null
var old_position_state = null
var new_position_state = null

var width = 0
var height = 0

function page_breaker_swap() {    
    temp = old_position_state
    old_position_state = new_position_state
    new_position_state = temp
}

function page_breaker_resize() {
    if(canvas != null) {
        canvas.style.width = window.innerWidth + "px"
        canvas.style.height = window.innerHeight + "px"

        width = window.innerWidth
        height = window.innerHeight
        var array_size = width * height * 4

        canvas.width = width
        canvas.height = height

        color_state = new Uint8ClampedArray(array_size)
        output_color_state = new Uint8ClampedArray(array_size)
        output_index_state = new Uint32Array(array_size / 4) //only 1 channel
        old_position_state = new Float32Array(array_size)
        new_position_state = new Float32Array(array_size)

        for(var y = 0; y < width; y++) {
            for(var x = 0; x < height; x++) {
                var index = (y * width + x) * 4
                old_position_state[index + 0] = y / width
                old_position_state[index + 1] = x / height
                old_position_state[index + 2] = 0
                old_position_state[index + 3] = 0
            }
        }
    }
}

function page_breaker_update() {

    for(var y = 0; y < width; y++) {
        for(var x = 0; x < height; x++) {
            var index = (y * width + x) * 4
            
            var position_x = old_position_state[index + 0]
            var position_y = old_position_state[index + 1]


            var output_index = (Math.round(position_y) * width + Math.round(position_x)) * 4
            output_color_state[output_index + 0] = color_state[index + 0]
            output_color_state[output_index + 1] = color_state[index + 1]
            output_color_state[output_index + 2] = color_state[index + 2]
            output_color_state[output_index + 3] = color_state[index + 3]
            output_index_state[output_index] = index
        }
    }
    

    //write output index state
    context.putImageData(new ImageData(output_color_state, width, height), 0, 0)
    page_breaker_swap()
    requestAnimationFrame(page_breaker_update)
}


function break_page() {
    console.log("breaking page")

    var overlay = document.getElementById("page_breaker_overlay")
    if(overlay == null) {
        overlay = document.createElement("div")
        overlay.setAttribute("data-html2canvas-ignore", "true")
        overlay.id = "page_breaker_overlay"
        overlay.style.position = "fixed"
        overlay.style.top = "0px"
        overlay.style.left = "0px"
        overlay.style.zIndex= "999"
        

        //create close button
        var close_button = document.createElement("p")
        close_button.onclick = () => {overlay.remove()}
        close_button.innerHTML = "X"
        close_button.style.cursor = "pointer"
        close_button.style.fontFamily = "Arial"
        close_button.style.padding = "10px"
        close_button.style.margin = "20px"
        close_button.style.fontSize = "2em"
        close_button.style.color = "white"
        close_button.style.borderRadius = "800px"
        close_button.style.backgroundColor = "brown"
        close_button.style.display = "inline-block"
        close_button.style.width = "30px"
        close_button.style.height = "30px"
        close_button.style.textAlign = "center"
        close_button.style.position = "fixed"
        close_button.style.top = "0px"
        close_button.style.right = "0px"
        close_button.style.zIndex= "999"
        overlay.appendChild(close_button)

        document.body.appendChild(overlay)
    }


    var c = document.getElementById("page_breaker_canvas")
    if(c != null) {
        c.remove()
    }
    
    html2canvas(document.body).then((initial_data_canvas) => {
        canvas = initial_data_canvas
        canvas.id="page_breaker_canvas"
        context = canvas.getContext("2d")
        context.imageSmoothingEnabled = false
        context.mozImageSmoothingEnabled = false
        context.oImageSmoothingEnabled = false
        context.webkitImageSmoothingEnabled = false
        context.msImageSmoothingEnabled = false

        overlay.appendChild(canvas)
        //copy initial data to the buffers
        var initial_data = context.getImageData(0, 0, window.innerWidth, window.innerHeight).data
        page_breaker_resize()
        for(var y = 0; y < window.innerHeight; y++) {
            for(var x = 0; x < window.innerWidth; x++) {
                var index = (y * window.innerWidth + x) * 4
                color_state[index + 0] = initial_data[index + 0]
                color_state[index + 1] = initial_data[index + 1]
                color_state[index + 2] = initial_data[index + 2]
                color_state[index + 3] = initial_data[index + 3]
            }
        }
        requestAnimationFrame(page_breaker_update)
    })

}

window.addEventListener("resize", page_breaker_resize)
old_state = new ImageData(window.innerWidth, window.innerHeight)