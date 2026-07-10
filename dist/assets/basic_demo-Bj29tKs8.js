const n=`{
  "hypergraph": {
    "name": "Basic Demo",
    "no_weights": false,
    "memory_mode": true,
    "nodes": [
      {
        "label": "A",
        "is_constant": false
      },
      {
        "label": "B",
        "is_constant": false
      },
      {
        "label": "C",
        "is_constant": false
      },
      {
        "label": "D",
        "is_constant": false
      },
      {
        "label": "E",
        "is_constant": false
      },
      {
        "label": "F",
        "is_constant": false
      }
    ],
    "edges": [
      {
        "label": "edge1",
        "rel": "def sum(a, b):\\n    return a + b\\n",
        "source_nodes": {
          "a": "A",
          "b": "B"
        },
        "target": "C",
        "weight": 100
      },
      {
        "label": "edge2",
        "rel": "def negate(a):\\n    return -a\\n",
        "source_nodes": {
          "a": "A"
        },
        "target": "D",
        "weight": 1
      },
      {
        "label": "edge3",
        "rel": "def negate(a):\\n    return -a\\n",
        "source_nodes": {
          "a": "B"
        },
        "target": "E",
        "weight": 26
      },
      {
        "label": "edge4",
        "rel": "def sum(a, b):\\n    return a + b\\n",
        "source_nodes": {
          "a": "D",
          "b": "E"
        },
        "target": "F",
        "weight": 1
      },
      {
        "label": "edge5",
        "rel": "def negate(a):\\n    return -a\\n",
        "source_nodes": {
          "a": "F"
        },
        "target": "C",
        "weight": 1
      }
    ]
  },
  "frames": {
    "default": {
      "A": [
        3
      ],
      "B": [
        7
      ],
      "E": [
        -7
      ],
      "C": [
        10
      ]
    },
    "blank_frame": {}
  }
}`;export{n as default};
