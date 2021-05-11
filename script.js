var canvas = null
var context = null

function page_breaker_resize() {
    if(canvas != null) {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
        canvas.style.width = window.innerWidth + "px"
        canvas.style.height = window.innerHeight + "px"
    }
}

function page_breaker_update() {
    context = canvas.getContext("2d")
    context.fillRect(0,0,100,100)

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
        overlay.appendChild(canvas)
        requestAnimationFrame(page_breaker_update)
    })

}

window.addEventListener("resize", page_breaker_resize)