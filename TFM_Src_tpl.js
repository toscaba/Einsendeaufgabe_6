/* Einsendeaufgabe 6 – Animation mit getrennten Model- und View-Matrizen. */
var app = (function () {
    'use strict';
    var gl, program, models = [], balls = [], torusModel;
    var running = false, lastTime = 0, phase = 0, speed = 1, rotateTorus = true;
    var camera = { angle: 0.48, height: 1.7, distance: 4.5,
        eye: [0, 0, 0], center: [0, 0, 0], up: [0, 1, 0],
        view: mat4.create(), projection: mat4.create() };
    var colors = [[0.24, 0.54, 0.94], [0.96, 0.43, 0.36],
                  [0.26, 0.77, 0.63], [0.80, 0.48, 0.93]];

    function compile(type, id) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, document.getElementById(id).textContent);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    function makeModel(geometry, color, scale, wireOnly) {
        var model = { color: color, scale: scale, wireOnly: !!wireOnly,
            translate: [0, 0, 0], rotate: [0, 0, 0],
            mMatrix: mat4.create(), mvMatrix: mat4.create() };
        geometry.createVertexData.call(model);
        model.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, model.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, model.vertices, gl.STATIC_DRAW);
        model.normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, model.normals, gl.STATIC_DRAW);
        model.triangleBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.triangleBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indicesTris, gl.STATIC_DRAW);
        model.lineBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.lineBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indicesLines, gl.STATIC_DRAW);
        models.push(model);
        return model;
    }

    function initialize() {
        gl = document.getElementById('canvas').getContext('webgl');
        if (!gl) throw new Error('WebGL ist nicht verfügbar.');
        program = gl.createProgram();
        gl.attachShader(program, compile(gl.VERTEX_SHADER, 'vertexshader'));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, 'fragmentshader'));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(program));
        }
        gl.useProgram(program);
        program.position = gl.getAttribLocation(program, 'aPosition');
        program.normal = gl.getAttribLocation(program, 'aNormal');
        program.projection = gl.getUniformLocation(program, 'uPMatrix');
        program.modelView = gl.getUniformLocation(program, 'uMVMatrix');
        program.color = gl.getUniformLocation(program, 'uColor');
        program.wire = gl.getUniformLocation(program, 'uWire');
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(1, 1);
        gl.clearColor(0.945, 0.965, 0.99, 1);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        torusModel = makeModel(torus, [0.24, 0.57, 0.81], [1, 1, 1]);
        for (var i = 0; i < 4; i++) {
            balls.push(makeModel(sphere, colors[i], [0.065, 0.065, 0.065]));
        }
        var grid = makeModel(plane, [0.64, 0.72, 0.82], [0.19, 1, 0.19], true);
        grid.translate = [0, -1.0, 0];
        updatePositions();
        bindControls();
        render();
    }

    function updatePositions() {
        // Kreisbahn in der XZ-Ebene: Mittelpunkt (0.65, 0, 0), Radius 0.65.
        // Bei x=0 geht jede Kugel durch die Torusöffnung; bei x=1.30 außen vorbei.
        // Vier Phasen mit 90° Abstand verhindern Kugel-Kugel-Kollisionen.
        balls.forEach(function (ball, i) {
            var angle = phase + i * Math.PI / 2;
            ball.translate = [0.65 + 0.65 * Math.cos(angle), 0, 0.65 * Math.sin(angle)];
        });
        // Kleine gekoppelte Neigung um X und Y; keine Autoreifenrotation.
        // Die geringe Amplitude hält den Torus von den Flugbahnen fern.
        torusModel.rotate = rotateTorus ?
            [0.12 * Math.sin(phase), 0.12 * Math.cos(phase), 0] : [0, 0, 0];
        document.getElementById('angle').textContent =
            'Bewegungsphase: ' + ((phase * 180 / Math.PI) % 360).toFixed(0) + '°';
    }

    function render() {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        camera.eye = [camera.distance * Math.sin(camera.angle), camera.height,
                      camera.distance * Math.cos(camera.angle)];
        mat4.lookAt(camera.view, camera.eye, camera.center, camera.up);
        mat4.perspective(camera.projection, Math.PI / 3,
            gl.canvas.width / gl.canvas.height, 0.1, 100);
        gl.uniformMatrix4fv(program.projection, false, camera.projection);

        models.forEach(function (model) {
            mat4.identity(model.mMatrix);
            mat4.translate(model.mMatrix, model.mMatrix, model.translate);
            mat4.rotateZ(model.mMatrix, model.mMatrix, model.rotate[2]);
            mat4.rotateY(model.mMatrix, model.mMatrix, model.rotate[1]);
            mat4.rotateX(model.mMatrix, model.mMatrix, model.rotate[0]);
            mat4.scale(model.mMatrix, model.mMatrix, model.scale);
            // Erst Model-Matrix, dann View-Matrix – keine Drehung um die Kamera.
            mat4.multiply(model.mvMatrix, camera.view, model.mMatrix);
            gl.uniformMatrix4fv(program.modelView, false, model.mvMatrix);
            gl.uniform3fv(program.color, model.color);
            gl.bindBuffer(gl.ARRAY_BUFFER, model.positionBuffer);
            gl.enableVertexAttribArray(program.position);
            gl.vertexAttribPointer(program.position, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
            gl.enableVertexAttribArray(program.normal);
            gl.vertexAttribPointer(program.normal, 3, gl.FLOAT, false, 0, 0);
            if (!model.wireOnly) {
                gl.uniform1i(program.wire, 0);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.triangleBuffer);
                gl.drawElements(gl.TRIANGLES, model.indicesTris.length, gl.UNSIGNED_SHORT, 0);
            }
            gl.uniform1i(program.wire, 1);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.lineBuffer);
            gl.drawElements(gl.LINES, model.indicesLines.length, gl.UNSIGNED_SHORT, 0);
        });
        document.getElementById('cameraStatus').textContent =
            'Kamera: ' + ((camera.angle * 180 / Math.PI % 360 + 360) % 360).toFixed(0) +
            '° · Höhe ' + camera.height.toFixed(1) + ' · Abstand ' + camera.distance.toFixed(1);
    }

    function advance(step) {
        phase = (phase + step) % (Math.PI * 2);
        updatePositions();
        render();
    }

    function animate(timestamp) {
        if (!running) return;
        if (lastTime) advance(Math.min((timestamp - lastTime) / 1000, 0.05) * speed);
        lastTime = timestamp;
        requestAnimationFrame(animate);
    }

    function toggleAnimation() {
        running = !running;
        document.getElementById('toggle').textContent = running ? 'Pause' : 'Animation starten';
        lastTime = 0;
        if (running) requestAnimationFrame(animate);
    }

    function bindControls() {
        document.getElementById('toggle').addEventListener('click', toggleAnimation);
        document.getElementById('step').addEventListener('click', function () { advance(0.13); });
        document.getElementById('speed').addEventListener('input', function () {
            speed = Number(this.value);
            document.getElementById('speedValue').textContent = speed.toFixed(1) + '×';
        });
        document.getElementById('torusToggle').addEventListener('change', function () {
            rotateTorus = this.checked;
            updatePositions();
            render();
        });
        document.getElementById('reset').addEventListener('click', function () {
            running = false;
            document.getElementById('toggle').textContent = 'Animation starten';
            phase = 0; camera.angle = 0.48; camera.height = 1.7; camera.distance = 4.5;
            updatePositions(); render();
        });
        window.addEventListener('keydown', function (event) {
            var key = event.key.toLowerCase();
            if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].indexOf(key) >= 0) {
                event.preventDefault();
            }
            switch (key) {
                case 'k': advance(0.13); break;
                case ' ': if (!event.repeat) toggleAnimation(); break;
                case 'arrowleft': camera.angle -= 0.13; render(); break;
                case 'arrowright': camera.angle += 0.13; render(); break;
                case 'arrowup': camera.height = Math.min(5, camera.height + 0.15); render(); break;
                case 'arrowdown': camera.height = Math.max(-5, camera.height - 0.15); render(); break;
                case 'n': camera.distance = Math.max(2.3, Math.min(10,
                    camera.distance + (event.shiftKey ? 0.3 : -0.3))); render(); break;
            }
        });
    }

    return { start: function () {
        try { initialize(); } catch (error) {
            console.error(error);
            document.getElementById('cameraStatus').textContent = 'Fehler: ' + error.message;
        }
    } };
}());
window.addEventListener('DOMContentLoaded', app.start);
