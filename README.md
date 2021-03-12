# Fairly Fast Fluids (A Psychorama for Ray)

## Todo

- ~Add black background to `.untouched` `.key` elements.~
- ~Set `.key` elements to `.untouched` until interacted with.~
- ~Make the velocity emitter buffers directly editable in the same way that the time-evolving velocity buffer is.~
- Make the radius and magnitude of the currently applied force directly editable without using the radius screen.
- Add a progression systems, which unlocks letters, views, and tools as you progress through the application.
- Add a cheat code that lets you skip the progression system :p
- Add a way of recording an evolution of the system, as a set of timestamped parameters and actions?

## Current Keymap

This is probably out of date. For a more up-to-date list, check the `actions` javascript object in the file `src/inputs.js`.

| Key | Action |
| --- | ------ |
| `Esc` | Toggle the overlay (and pause the simulation?) |
| `?` | Toggle the colophon. |
| `1` | Show the light field. |
| `2` | Show the current state of the velocity field |
| `3` | Show the current state of the emitter field |
| `4` | Show the color picker |
| `5` | Show the radius picker |
| `6` | Bonus feature: show the pressure field |
| `space` | While Light Field is active: Momentarily show thresholded regions (make threshold manipulate-able?)
| *Other Keys* | Populate the emitter field with that character in the currently selected style |



## References

This repository contains a browser-based, 2D, GPU fluid simulation using the `regl` library for WebGL. The implementation of the fluid simulation is a modified version of the techniques described by [GPU Gems, Chapter 38: Fast Fluid Dynamics Simulation on the GPU](https://developer.download.nvidia.com/books/HTML/gpugems/gpugems_ch38.html), with additional references to Jamie Wong's [Fluid Simulation (with WebGL)](http://jamie-wong.com/2016/08/05/webgl-fluid-simulation/#solving-for-pressure) article, and Pavel Dobryakov's [WebGL Fluid Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) repository.

### Caustics and Refraction

- [Real Time Rendering of Water Caustics](https://medium.com/@martinRenou/real-time-rendering-of-water-caustics-59cda1d74aa)
- [WebGL Refraction Lense](https://www.taylorpetrick.com/portfolio/webgl/lense). Also see [this](https://www.taylorpetrick.com/blog/post/dispersion-opengl).


### Schroedinger Equation

- [GPGPU Schroedinger Equation](http://www.vizitsolutions.com/portfolio/webgl/gpgpu/schrodingerEquation.html)
