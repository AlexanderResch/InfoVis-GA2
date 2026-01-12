# Information Visualisation - Individual Assignment 3

## Visualization type
A world map showing the dots score, median of total liftet kg or number of athletes of a country on a color scale. Individual countries can be hovered over to show a tooltip or be clicked to fill the detail panel with individual statistics. This makes it easy to see how the sport is distributed across the world in different ways.

---

## Dataset
Our group wants to visualize data from openpowerlifting.org, an open-source dataset containing over 3.6 million rows of competiton performances in the sport of powerlifting (a form of weightlifting). This is a very measurable sport, performed by athletes from different places around the world, weights, ages and with different sets of equipment and rules.

To preserve efficiency, I reduced the dataset to only relevant columns. This has be done by a Python script (create_subset.py), which is located in the data folder.

### Variables of the subset:
- Sex - male, female or neutral  
- TotalKg - sum of best results if all 3 successful, rarely negative to record the lowest weight attempted and failed  
- Dots - calculated Dots-score of performance, empty if disqualified  
- Tested - whether the competition counts as drug tested or not  
- Country - athletes country  
- Date - date or start date of competition  

Also a world.geojson was added for placing the countries on the map.

---

## Visual encodings:
- **Position** - Each country is located on a map by its geographical coordinates. A GeoJSON provides the needed data for this.  
- **Color** - The colors and brightness for in which the countries are filled. Shows the value of the metric by color.  
- **Shape/Boundaries** - Each country has its polygonal shape by using the GeoJSON coordinates.  
- **Selection Outline** - If a user clicks on a Country, the boarders of the specific country are outlined in black.  
- **Tooltip** - If a user hovers on a country, a tooltip is shown. The tooltip shows the country name, the metric, as well as the number of athletes of this country.  
- **Detail panel** - A detail panel next to the map shows more country specific data like median dots, median total lifted (kg), number of athletes, count of male and female athletes and count of tested and tested-unknown athletes.  
- **Color legend** - For explaining the color encodings, there is a horizontal bar legend. The bar is filled with a gradient from lightblue (nearly white) to dark blue. There are also labels at the beginning, the middle and the end. They are the minimum, median and maximum.  
- **Interactive filters** - For limiting the visualization content, there are added 3 interactive filters. The user is able to filter by sex, if an athlete is tested, or the metric. After selecting a specific filter, the map and its coloring is updated.

---

## Scales:
For the metrics median dots and median total (kg) is used sequential linear scale. With this scale there were problems for the metric number of athletes, because some countries like USA (998013) and russia (297508) have excessive more athletes than the most other countries. The median is 272. In this case, nearly the whole map would be light blue. To solve this problem, a logarithmic scale was used to show a better distribution and differences between mid-range countries.

---

## Usage of other sources:
This source was used to get valid GeoJSON data:  
Source: https://d3-graph-gallery.com/graph/choropleth_basic.html  
GeoJSON: https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson

I searched on the internet for tutorials and also used D3-documentation and Stack Overflow.  
I don't copy paste other projects, but had a look, how other people solved their implementation.

---

## Generative AI usage:
- For map display formatting, southpole shouldn't be displayed, because it isn't in the dataset. Further the other contents are bigger and can be better displayed without it. To solve this problem I asked ChatGPT for a solution.  
- Used ChatGPT at the updateLegend() function, specifically for helping in setting the new gradient and updating the legend.  
- ChatGPT helped me in CSS styling, to solve layout problems.  
- I also used ChatGPT for debugging of complex error stacktraces.  
- To push the visualization on GitHub Pages, our dataset even after reduction had too big size. Therefore I compromissed the sub-dataset and extracted it in script.js. ChatGPR also helped me doing that.
